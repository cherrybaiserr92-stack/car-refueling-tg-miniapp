const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Переключение видов
const segBtns = document.querySelectorAll('.seg-btn');
const views = document.querySelectorAll('.view');
const mapView = document.getElementById('mapView');
const listView = document.getElementById('listView');
const workBtn = document.getElementById('workBtn');
let currentTaskRequest = null;

function switchView(viewId) {
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (viewId === 'mapView') {
        setTimeout(() => map.invalidateSize(), 100);
    }
    if (viewId !== 'mapView') {
        map.closePopup();
        hideActionPanel();
        clearRoute();
    }
}

segBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const viewId = btn.dataset.view;
        if (!viewId) return;
        segBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        switchView(viewId);
    });
});

// Карта
const map = L.map('map', {
    center: [59.9343, 30.3351],
    zoom: 13,
    zoomControl: false,
    attributionControl: false
});

L.tileLayer('https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: 'Google'
}).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// --- Местоположение пользователя ---
let userMarker = null;
let accuracyCircle = null;
let userLocation = null;

function createUserMarker(latlng, accuracy) {
    if (userMarker) map.removeLayer(userMarker);
    if (accuracyCircle) map.removeLayer(accuracyCircle);
    userMarker = L.circleMarker(latlng, {
        radius: 8,
        fillColor: '#007aff',
        fillOpacity: 1,
        color: 'white',
        weight: 2,
        opacity: 1
    }).addTo(map);
    accuracyCircle = L.circle(latlng, {
        radius: accuracy,
        fillColor: '#007aff',
        fillOpacity: 0.15,
        color: '#007aff',
        weight: 1,
        opacity: 0.3
    }).addTo(map);
    userLocation = latlng;
}

if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
        (pos) => {
            const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
            const accuracy = pos.coords.accuracy;
            createUserMarker(latlng, accuracy);
        },
        (err) => console.warn('Геолокация недоступна', err.message),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
}

// --- Кнопка компаса ---
document.getElementById('locationBtn').addEventListener('click', () => {
    if (!userLocation) {
        tg.showAlert('Местоположение ещё не определено');
        return;
    }
    map.setView(userLocation, map.getZoom(), { animate: true, duration: 0.5 });
});

// --- Маршрут OSRM ---
let currentRouteLayer = null;
function clearRoute() {
    if (currentRouteLayer) {
        map.removeLayer(currentRouteLayer);
        currentRouteLayer = null;
    }
}
async function buildRoute(from, to) {
    clearRoute();
    if (!from || !to) return;
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full`;
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) return;
        const route = data.routes[0].geometry;
        const geojson = { type: 'Feature', geometry: route };
        currentRouteLayer = L.geoJSON(geojson, {
            style: { color: '#007aff', weight: 5, opacity: 0.8, lineJoin: 'round', lineCap: 'round' }
        }).addTo(map);
    } catch (error) {
        console.error('Ошибка построения маршрута', error);
    }
}

// --- Заявки ---
let allRequests = [];
let markers = [];
let currentFilter = 'all';

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFilter();
    });
});

function getStatusText(status) {
    return status === 'active' ? 'Срочно' : status === 'in_progress' ? 'В работе' : 'Готово';
}
function markerColor(fuelLevel) {
    if (fuelLevel < 25) return '#ff3b30';
    if (fuelLevel <= 50) return '#ff9500';
    return '#34c759';
}
function lightenColor(hex, factor) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const to = (c) => Math.min(255, Math.floor(c + (255 - c) * factor));
    return `rgb(${to(r)}, ${to(g)}, ${to(b)})`;
}

// Значки заявок с белым объёмным обрамлением
function createMarkerIcon(req) {
    const color = markerColor(req.fuelLevel);
    const gradient = `radial-gradient(circle at 30% 30%, ${lightenColor(color, 0.4)}, ${color})`;
    return L.divIcon({
        html: `<div style="
            background:${gradient};
            width:18px; height:18px;
            border-radius:50%;
            border: 2px solid white;
            box-shadow: 0 0 6px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.3);
        "></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        className: ''
    });
}

// ===== КОМПАКТНЫЙ ПОПАП =====
function createPopupContent(req) {
    const container = document.createElement('div');
    container.className = 'popup-info';

    // Марка / модель
    const modelLine = document.createElement('div');
    modelLine.className = 'popup-model-line';
    modelLine.textContent = req.carModel;

    // Госномер
    const plateLine = document.createElement('div');
    plateLine.className = 'popup-plate-line';
    plateLine.textContent = req.licensePlate;

    // Полоса топлива с анимацией
    const fuelWrapper = document.createElement('div');
    fuelWrapper.className = 'popup-fuel-wrapper';

    const fuelFill = document.createElement('div');
    fuelFill.className = 'popup-fuel-fill';
    fuelFill.style.width = req.fuelLevel + '%';
    fuelFill.style.setProperty('--fuel-color', markerColor(req.fuelLevel));

    const fuelText = document.createElement('span');
    fuelText.className = 'popup-fuel-text';
    fuelText.textContent = req.fuelLevel + '%';

    fuelWrapper.appendChild(fuelFill);
    fuelWrapper.appendChild(fuelText);

    container.appendChild(modelLine);
    container.appendChild(plateLine);
    container.appendChild(fuelWrapper);

    return container;
}

// Панель действий с дополнительной кнопкой "Найти по фото"
const actionPanel = document.getElementById('actionPanel');
const acceptBtn = document.getElementById('acceptBtn');
const routeBtn = document.getElementById('routeBtn');
const photoSearchBtn = document.getElementById('photoSearchBtn');

function showActionPanel(req) {
    actionPanel.classList.remove('hidden');
    acceptBtn.onclick = () => startTask(req);
    routeBtn.onclick = () => {
        const coords = `${req.lat}, ${req.lng}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(coords).then(() => tg.showAlert('Координаты скопированы'));
        } else {
            tg.showAlert(`Координаты: ${coords}`);
        }
    };
    photoSearchBtn.onclick = () => {
        // Заглушка: можно открыть Google Images с моделью авто
        tg.showAlert(`Поиск фото "${req.carModel}" появится позже`);
    };
}

function hideActionPanel() {
    actionPanel.classList.add('hidden');
    acceptBtn.onclick = null;
    routeBtn.onclick = null;
    photoSearchBtn.onclick = null;
}

// Элементы формы заявки
const photoBeforeBtn = document.getElementById('photoBeforeBtn');
const photoAfterBtn = document.getElementById('photoAfterBtn');
const photoBeforeInput = document.getElementById('photoBeforeInput');
const photoAfterInput = document.getElementById('photoAfterInput');
const litersInput = document.getElementById('litersInput');
const commentInput = document.getElementById('commentInput');
const openDoorsBtn = document.getElementById('openDoorsBtn');
const closeDoorsBtn = document.getElementById('closeDoorsBtn');
const closeTaskBtn = document.getElementById('closeTaskBtn');
const cancelTaskBtn = document.getElementById('cancelTaskBtn');

// Открытие камеры с геометкой
function setupPhotoButton(btn, input) {
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            // Запрашиваем геолокацию для геометки
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const lat = pos.coords.latitude.toFixed(6);
                        const lng = pos.coords.longitude.toFixed(6);
                        const time = new Date(pos.timestamp).toLocaleString();
                        tg.showAlert(`Геометка: ${lat}, ${lng}\nВремя: ${time}`);
                        // Здесь можно сохранить координаты в скрытое поле или добавить к комментарию
                    },
                    () => tg.showAlert('Не удалось получить координаты')
                );
            }
            tg.showAlert('Фото выбрано');
        }
    });
}
setupPhotoButton(photoBeforeBtn, photoBeforeInput);
setupPhotoButton(photoAfterBtn, photoAfterInput);

openDoorsBtn.addEventListener('click', () => tg.showAlert('Двери открыты'));
closeDoorsBtn.addEventListener('click', () => tg.showAlert('Двери закрыты'));

closeTaskBtn.addEventListener('click', () => completeTask('closed'));
cancelTaskBtn.addEventListener('click', () => {
    if (confirm('Уверены, что хотите отменить заявку?')) completeTask('cancelled');
});

function completeTask(reason) {
    const liters = litersInput.value;
    const comment = commentInput.value;
    console.log(`Заявка ${currentTaskRequest?.id} завершена: ${reason}, литры: ${liters}, комментарий: ${comment}`);
    currentTaskRequest = null;
    workBtn.classList.remove('visible');
    switchView('mapView');
    segBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('.seg-btn[data-view="mapView"]').classList.add('active');
    litersInput.value = '';
    commentInput.value = '';
    photoBeforeInput.value = '';
    photoAfterInput.value = '';
    tg.showAlert(reason === 'closed' ? 'Заявка закрыта' : 'Заявка отменена');
}

function startTask(req) {
    currentTaskRequest = req;
    workBtn.classList.add('visible');
    switchView('workView');
    segBtns.forEach(b => b.classList.remove('active'));
    workBtn.classList.add('active');
    hideActionPanel();
    map.closePopup();
    clearRoute();
    tg.showAlert(`Заявка #${req.id} принята в работу`);
}

// Рендер маркеров
function renderMarkers(requests) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    requests.forEach(req => {
        const marker = L.marker([req.lat, req.lng], { icon: createMarkerIcon(req) }).addTo(map);
        marker.bindPopup(createPopupContent(req));
        marker.on('popupopen', () => {
            showActionPanel(req);
            if (userLocation) {
                buildRoute(
                    { lat: userLocation.lat, lng: userLocation.lng },
                    { lat: req.lat, lng: req.lng }
                );
            }
        });
        marker.on('popupclose', () => {
            hideActionPanel();
            clearRoute();
        });
        markers.push(marker);
    });
}

// Рендер списка
function renderList(requests) {
    const list = document.getElementById('request-list');
    if (!list) return;
    if (requests.length === 0) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--tg-hint)">Нет заявок</div>';
        return;
    }
    list.innerHTML = requests.map(r => `
        <div class="request-card" data-lat="${r.lat}" data-lng="${r.lng}">
            <div class="request-info">
                <div class="car-name">${r.carModel}</div>
                <div class="license-plate">${r.licensePlate}</div>
                <div class="fuel-bar">
                    <div class="fuel-fill" style="width:${r.fuelLevel}%"></div>
                </div>
            </div>
            <span class="status-badge status-${r.status}">${getStatusText(r.status)}</span>
        </div>
    `).join('');

    document.querySelectorAll('.request-card').forEach(card => {
        card.addEventListener('click', () => {
            const mapBtn = document.querySelector('.seg-btn[data-view="mapView"]');
            if (mapBtn) mapBtn.click();
            const lat = parseFloat(card.dataset.lat);
            const lng = parseFloat(card.dataset.lng);
            const marker = markers.find(m => {
                const ll = m.getLatLng();
                return Math.abs(ll.lat - lat) < 0.0001 && Math.abs(ll.lng - lng) < 0.0001;
            });
            if (marker) {
                map.setView([lat, lng], 15, { animate: true, duration: 0.3 });
                marker.openPopup();
            }
        });
    });
}

function applyFilter() {
    const filtered = currentFilter === 'all' ? allRequests : allRequests.filter(r => r.status === currentFilter);
    renderMarkers(filtered);
    renderList(filtered);
}

async function loadRequests() {
    try {
        const res = await fetch('/api/requests');
        allRequests = await res.json();
        applyFilter();
    } catch (e) {
        console.error(e);
        const list = document.getElementById('request-list');
        if (list) list.innerHTML = 'Ошибка загрузки';
    }
}
loadRequests();

// Подстраховка стилей
const style = document.createElement('style');
style.textContent = `
    .leaflet-popup-content-wrapper {
        background: rgba(30,30,32,0.75) !important;
        backdrop-filter: blur(30px);
        padding: 0;
    }
    .leaflet-popup-tip {
        background: rgba(30,30,32,0.75) !important;
    }
`;
document.head.appendChild(style);

map.on('click', () => hideActionPanel());
