const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Переключение видов
const segBtns = document.querySelectorAll('.seg-btn');
const views = document.querySelectorAll('.view');
const mapView = document.getElementById('mapView');
const workBtn = document.getElementById('workBtn');
const taskLocationBtn = document.getElementById('taskLocationBtn');
let currentTaskRequest = null;
let activeTaskMarker = null;
const MAX_FUEL = 320;

function switchView(viewId) {
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (viewId === 'mapView') setTimeout(() => map.invalidateSize(), 100);
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
L.tileLayer('https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: 'Google' }).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// --- Местоположение ---
let userMarker = null, accuracyCircle = null, userLocation = null;
function createUserMarker(latlng, accuracy) {
    if (userMarker) map.removeLayer(userMarker);
    if (accuracyCircle) map.removeLayer(accuracyCircle);
    userMarker = L.circleMarker(latlng, { radius: 8, fillColor: '#007aff', fillOpacity: 1, color: 'white', weight: 2, opacity: 1 }).addTo(map);
    accuracyCircle = L.circle(latlng, { radius: accuracy, fillColor: '#007aff', fillOpacity: 0.15, color: '#007aff', weight: 1, opacity: 0.3 }).addTo(map);
    userLocation = latlng;
}
if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
        (pos) => createUserMarker(L.latLng(pos.coords.latitude, pos.coords.longitude), pos.coords.accuracy),
        (err) => console.warn('Геолокация недоступна', err.message),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
}

// --- Компас ---
document.getElementById('locationBtn').addEventListener('click', () => {
    if (!userLocation) return tg.showAlert('Местоположение ещё не определено');
    map.setView(userLocation, map.getZoom(), { animate: true, duration: 0.5 });
});

// --- Кнопка возврата к активной заявке ---
taskLocationBtn.addEventListener('click', () => {
    if (!activeTaskMarker) {
        tg.showAlert('Нет активной заявки');
        return;
    }
    const latlng = activeTaskMarker.getLatLng();
    map.panTo(latlng, { animate: true, duration: 0.5 });
    activeTaskMarker.openPopup();
});

// --- Маршрут OSRM ---
let currentRouteLayer = null;
function clearRoute() { if (currentRouteLayer) { map.removeLayer(currentRouteLayer); currentRouteLayer = null; } }
async function buildRoute(from, to) {
    clearRoute();
    if (!from || !to) return;
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full`;
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) return;
        currentRouteLayer = L.geoJSON({ type: 'Feature', geometry: data.routes[0].geometry }, {
            style: { color: '#007aff', weight: 5, opacity: 0.8 }
        }).addTo(map);
    } catch (e) { console.error('Ошибка построения маршрута', e); }
}

// --- Данные заявок и аккаунта ---
let allRequests = [], markers = [];
let fuelRemaining = 210; // начальный остаток, например 210 л из 320
let carsRefueled = 0;
let litersDispensed = 0;

function updateAccountStats() {
    // Обновляем бочку
    const percentage = Math.min(100, (fuelRemaining / MAX_FUEL) * 100);
    const tankFill = document.getElementById('fuelTankFill');
    tankFill.style.height = percentage + '%';
    // Цвет как у заявок
    let color;
    if (percentage <= 15) color = '#ff3b30';
    else if (percentage <= 25) color = '#ff9500';
    else color = '#34c759';
    tankFill.style.backgroundColor = color;

    // Пересоздаём пузырьки (чтобы анимация перезапустилась)
    const bubblesContainer = document.getElementById('fuelTankBubbles');
    bubblesContainer.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const b = document.createElement('div');
        b.className = 'fuel-bubble';
        b.style.left = (Math.random() * 80 + 10) + '%';
        b.style.bottom = (Math.random() * 20 + 5) + '%';
        b.style.width = (Math.random() * 4 + 2) + 'px';
        b.style.height = b.style.width;
        b.style.animationDelay = Math.random() * 2 + 's';
        bubblesContainer.appendChild(b);
    }

    document.getElementById('fuelTankText').textContent = fuelRemaining + ' л';

    // Статистика
    document.getElementById('carsRefueled').textContent = carsRefueled;
    document.getElementById('litersDispensed').textContent = litersDispensed + ' л';
    const totalNeeded = allRequests
        .filter(r => r.status !== 'done')
        .reduce((sum, r) => sum + ((100 - r.fuelLevel) / 100) * 50, 0);
    document.getElementById('totalNeeded').textContent = totalNeeded.toFixed(1) + ' л';
}

// Кнопки заправки
document.getElementById('refuelA92Btn').addEventListener('click', () => {
    fuelRemaining = MAX_FUEL;
    updateAccountStats();
    tg.showAlert('Бензовоз заправлен АИ-92 до полного');
});

document.getElementById('refuelDTBtn').addEventListener('click', () => {
    fuelRemaining = MAX_FUEL;
    updateAccountStats();
    tg.showAlert('Бензовоз заправлен ДТ до полного');
});

// Кнопки поддержка и инструкции
document.getElementById('supportBtn').addEventListener('click', () => {
    tg.showAlert('Поддержка: свяжитесь с диспетчером');
});
document.getElementById('instructionsBtn').addEventListener('click', () => {
    tg.showAlert('Инструкция по заправке каршеринга...');
});

async function loadRequests() {
    try {
        const res = await fetch('/api/requests');
        allRequests = await res.json();
        renderMarkers(allRequests);
        updateAccountStats();
    } catch (e) { console.error(e); }
}

function markerColor(fuel) {
    if (fuel <= 15) return '#ff3b30';
    if (fuel <= 25) return '#ff9500';
    return '#34c759';
}
function lightenColor(hex, f) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const to = c => Math.min(255, Math.floor(c + (255-c)*f));
    return `rgb(${to(r)},${to(g)},${to(b)})`;
}

function createMarkerIcon(req, isActive = false) {
    let gradient;
    if (isActive) {
        gradient = '#000000';
    } else {
        const color = markerColor(req.fuelLevel);
        gradient = `radial-gradient(circle at 30% 30%, ${lightenColor(color,0.4)}, ${color})`;
    }
    return L.divIcon({
        html: `<div style="background:${gradient}; width:18px; height:18px; border-radius:50%; border:2px solid white; box-shadow:0 0 6px rgba(0,0,0,0.6),0 0 0 2px rgba(255,255,255,0.3);"></div>`,
        iconSize: [22,22], iconAnchor: [11,11], className: ''
    });
}

// ===== PIN-МАРКЕР =====
function createPopupContent(req) {
    const container = document.createElement('div');
    container.className = 'popup-pin';

    const body = document.createElement('div');
    body.className = 'popup-pin-body';

    const fill = document.createElement('div');
    fill.className = 'popup-pin-fill';
    fill.style.height = req.fuelLevel + '%';
    fill.style.setProperty('--fuel-color', markerColor(req.fuelLevel));

    const bubbles = document.createElement('div');
    bubbles.className = 'popup-pin-bubbles';
    for (let i = 0; i < 4; i++) {
        const b = document.createElement('div');
        b.className = 'popup-bubble';
        bubbles.appendChild(b);
    }

    const model = document.createElement('div');
    model.className = 'popup-model';
    model.textContent = req.carModel;

    const plate = document.createElement('div');
    plate.className = 'popup-plate';
    plate.textContent = req.licensePlate;

    const percent = document.createElement('div');
    percent.className = 'popup-percent';
    percent.textContent = req.fuelLevel + '%';

    body.appendChild(fill);
    body.appendChild(bubbles);
    body.appendChild(model);
    body.appendChild(plate);
    body.appendChild(percent);

    const tip = document.createElement('div');
    tip.className = 'popup-pin-tip';

    container.appendChild(body);
    container.appendChild(tip);
    return container;
}

// Панель действий
const actionPanel = document.getElementById('actionPanel');
const acceptBtn = document.getElementById('acceptBtn');
const routeBtn = document.getElementById('routeBtn');
const photoSearchBtn = document.getElementById('photoSearchBtn');

function showActionPanel(req, marker) {
    if (currentTaskRequest) {
        acceptBtn.style.display = 'none';
    } else {
        acceptBtn.style.display = 'block';
        acceptBtn.onclick = () => startTask(req, marker);
    }
    actionPanel.classList.remove('hidden');
    routeBtn.onclick = () => {
        const coords = `${req.lat}, ${req.lng}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(coords).then(() => tg.showAlert('Координаты скопированы'));
        } else tg.showAlert(`Координаты: ${coords}`);
    };
    photoSearchBtn.onclick = () => tg.showAlert(`Поиск фото "${req.carModel}" появится позже`);
}

function hideActionPanel() {
    actionPanel.classList.add('hidden');
    acceptBtn.onclick = null;
    routeBtn.onclick = null;
    photoSearchBtn.onclick = null;
}

// Элементы окна выполнения
const taskCarModel = document.getElementById('taskCarModel');
const taskPlate = document.getElementById('taskPlate');
const taskCoords = document.getElementById('taskCoords');
const taskId = document.getElementById('taskId');
const copyPlateBtn = document.getElementById('copyPlateBtn');
const copyCoordsBtn = document.getElementById('copyCoordsBtn');
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

function setupPhotoButton(btn, input) {
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => tg.showAlert(`Геометка: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}\nВремя: ${new Date(pos.timestamp).toLocaleString()}`),
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

copyPlateBtn.addEventListener('click', () => {
    if (currentTaskRequest) {
        navigator.clipboard.writeText(currentTaskRequest.licensePlate).then(() => tg.showAlert('Номер скопирован'));
    }
});
copyCoordsBtn.addEventListener('click', () => {
    if (currentTaskRequest) {
        const coords = `${currentTaskRequest.lat}, ${currentTaskRequest.lng}`;
        navigator.clipboard.writeText(coords).then(() => tg.showAlert('Координаты скопированы'));
    }
});

closeTaskBtn.addEventListener('click', () => {
    if (!currentTaskRequest) return;
    const liters = parseFloat(litersInput.value);
    if (isNaN(liters) || liters <= 0) {
        tg.showAlert('Введите корректный литраж');
        return;
    }
    completeTask('closed', liters);
});

cancelTaskBtn.addEventListener('click', () => {
    if (confirm('Отменить заявку?')) completeTask('cancelled');
});

function completeTask(reason, liters = 0) {
    if (reason === 'closed' && currentTaskRequest) {
        fuelRemaining = Math.max(0, fuelRemaining - liters);
        carsRefueled += 1;
        litersDispensed += liters;
        currentTaskRequest.status = 'done';
        if (activeTaskMarker) {
            map.removeLayer(activeTaskMarker);
            activeTaskMarker = null;
        }
        allRequests = allRequests.filter(r => r.id !== currentTaskRequest.id);
        renderMarkers(allRequests);
    }
    updateAccountStats();
    taskCarModel.textContent = '';
    taskPlate.textContent = '';
    taskCoords.textContent = '';
    taskId.textContent = '';
    litersInput.value = '';
    commentInput.value = '';
    photoBeforeInput.value = '';
    photoAfterInput.value = '';
    currentTaskRequest = null;
    workBtn.classList.remove('visible');
    taskLocationBtn.classList.remove('visible');
    switchView('mapView');
    segBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('.seg-btn[data-view="mapView"]').classList.add('active');
    tg.showAlert(reason === 'closed' ? 'Заявка закрыта' : 'Заявка отменена');
}

function startTask(req, marker) {
    currentTaskRequest = req;
    activeTaskMarker = marker;
    taskCarModel.textContent = req.carModel;
    taskPlate.textContent = req.licensePlate;
    taskCoords.textContent = `${req.lat}, ${req.lng}`;
    taskId.textContent = req.id;
    workBtn.classList.add('visible');
    taskLocationBtn.classList.add('visible');
    switchView('workView');
    segBtns.forEach(b => b.classList.remove('active'));
    workBtn.classList.add('active');
    hideActionPanel();
    marker.setIcon(createMarkerIcon(req, true));
    map.closePopup();
    tg.showAlert(`Заявка #${req.id} принята в работу`);
}

// Рендер маркеров
function renderMarkers(requests) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    requests.forEach(req => {
        const isActive = currentTaskRequest && req.id === currentTaskRequest.id;
        const icon = isActive ? createMarkerIcon(req, true) : createMarkerIcon(req);
        const marker = L.marker([req.lat, req.lng], { icon: icon }).addTo(map);
        marker.bindPopup(createPopupContent(req));

        marker.on('popupopen', (e) => {
            map.panTo([req.lat, req.lng], { animate: true, duration: 0.5 });
            showActionPanel(req, marker);
            if (userLocation) buildRoute({ lat: userLocation.lat, lng: userLocation.lng }, { lat: req.lat, lng: req.lng });
        });
        marker.on('popupclose', () => {
            hideActionPanel();
            clearRoute();
        });
        markers.push(marker);
    });
    if (activeTaskMarker && !allRequests.find(r => r.id === currentTaskRequest?.id)) {
        activeTaskMarker = null;
        taskLocationBtn.classList.remove('visible');
    }
}

// Старт
loadRequests();

// Стилизация Leaflet
const style = document.createElement('style');
style.textContent = `.leaflet-popup-content-wrapper { background: transparent !important; box-shadow: none !important; backdrop-filter: none !important; } .leaflet-popup-tip { display: none; }`;
document.head.appendChild(style);

map.on('click', () => hideActionPanel());
