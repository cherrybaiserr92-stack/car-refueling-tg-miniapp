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
const MAX_FUEL_92 = 320;
const MAX_FUEL_DT = 1000;
const MAX_FUEL_95 = 0; // не используется

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
    if (!activeTaskMarker) { tg.showAlert('Нет активной заявки'); return; }
    map.panTo(activeTaskMarker.getLatLng(), { animate: true, duration: 0.5 });
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
    } catch (e) { console.error(e); }
}

// --- Данные ---
let allRequests = [], markers = [];
let carsRefueled = 0;
let litersDispensed = 0;
const refuelLog = []; // история заправок

const fuelTanks = {
    ai92: 210,
    dt: 600,  // будет пополнено до 1000
    ai95: 0
};
const maxFuel = {
    ai92: MAX_FUEL_92,
    dt: MAX_FUEL_DT,
    ai95: MAX_FUEL_95
};
let currentFuelType = 'ai92'; // по умолчанию 92

function updateAccountStats() {
    updateTank('ai92');
    updateTank('dt');
    updateTank('ai95');
    document.getElementById('carsRefueled').textContent = carsRefueled;
    document.getElementById('litersDispensed').textContent = litersDispensed + ' л';
    const totalNeeded = allRequests
        .filter(r => r.status !== 'done')
        .reduce((sum, r) => sum + ((100 - r.fuelLevel) / 100) * 50, 0);
    document.getElementById('totalNeeded').textContent = totalNeeded.toFixed(1) + ' л';
}

function updateTank(type) {
    const fuel = fuelTanks[type];
    const max = maxFuel[type];
    const percentage = Math.min(100, (fuel / max) * 100);
    const fillEl = document.getElementById(`fill${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (fillEl) {
        fillEl.style.height = percentage + '%';
        let color;
        if (percentage <= 15) color = '#ff3b30';
        else if (percentage <= 25) color = '#ff9500';
        else color = '#34c759';
        fillEl.style.backgroundColor = color;
    }
    const bubblesEl = document.getElementById(`bubbles${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (bubblesEl) {
        bubblesEl.innerHTML = '';
        for (let i = 0; i < 6; i++) {
            const b = document.createElement('div');
            b.className = 'fuel-bubble';
            b.style.left = (Math.random() * 80 + 10) + '%';
            b.style.bottom = (Math.random() * 20 + 5) + '%';
            b.style.width = (Math.random() * 4 + 2) + 'px';
            b.style.height = b.style.width;
            b.style.animationDelay = Math.random() * 2 + 's';
            bubblesEl.appendChild(b);
        }
    }
    const textEl = document.getElementById(`text${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (textEl) textEl.textContent = fuel + ' л';
}

// Кнопки заправки
document.getElementById('refuelA92Btn').addEventListener('click', () => {
    fuelTanks.ai92 = maxFuel.ai92;
    updateAccountStats();
    tg.showAlert('Канистра АИ-92 заправлена до полного');
});
document.getElementById('refuelDTBtn').addEventListener('click', () => {
    fuelTanks.dt = maxFuel.dt;
    updateAccountStats();
    tg.showAlert('Канистра ДТ заправлена до полного');
});

// Карусель
const carousel = document.getElementById('tankCarousel');
let touchStartX = 0, touchEndX = 0;
carousel.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
carousel.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});
function handleSwipe() {
    const diff = touchEndX - touchStartX;
    if (Math.abs(diff) < 50) return;
    if (diff > 0) moveCarousel(-1);
    else moveCarousel(1);
}
function moveCarousel(direction) {
    const panels = Array.from(carousel.querySelectorAll('.tank-panel'));
    if (panels.length < 3) return;
    const centerIndex = panels.findIndex(p => p.classList.contains('tank-center'));
    if (centerIndex === -1) return;
    panels.forEach(p => p.classList.remove('tank-left', 'tank-center', 'tank-right', 'tank-hidden-left', 'tank-hidden-right'));
    let newCenterIndex = centerIndex + direction;
    if (newCenterIndex < 0) newCenterIndex = panels.length - 1;
    if (newCenterIndex >= panels.length) newCenterIndex = 0;
    const leftIndex = (newCenterIndex - 1 + panels.length) % panels.length;
    const rightIndex = (newCenterIndex + 1) % panels.length;
    panels[newCenterIndex].classList.add('tank-center');
    panels[leftIndex].classList.add('tank-left');
    panels[rightIndex].classList.add('tank-right');
    panels.forEach((p, i) => {
        if (i !== newCenterIndex && i !== leftIndex && i !== rightIndex) {
            p.classList.add(direction > 0 ? 'tank-hidden-left' : 'tank-hidden-right');
        }
    });
    currentFuelType = panels[newCenterIndex].dataset.fuel;
}
function initCarousel() {
    const panels = carousel.querySelectorAll('.tank-panel');
    if (panels.length < 3) return;
    panels[1].classList.add('tank-center');
    panels[0].classList.add('tank-left');
    panels[2].classList.add('tank-right');
    currentFuelType = panels[1].dataset.fuel;
}
initCarousel();

// Шестерёнка и меню
const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); settingsMenu.classList.toggle('hidden'); });
document.addEventListener('click', (e) => {
    if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) settingsMenu.classList.add('hidden');
});
document.getElementById('menuSupport').addEventListener('click', () => { tg.showAlert('Поддержка: звоните диспетчеру'); settingsMenu.classList.add('hidden'); });
document.getElementById('menuInstructions').addEventListener('click', () => { tg.showAlert('Инструкция по заправке...'); settingsMenu.classList.add('hidden'); });
document.getElementById('menuSOS').addEventListener('click', () => { tg.showAlert('SOS: помощь уже в пути'); settingsMenu.classList.add('hidden'); });

// --- Всплывающая панель со списками ---
const detailsPanel = document.getElementById('detailsPanel');
const detailsTitle = document.getElementById('detailsTitle');
const detailsContent = document.getElementById('detailsContent');
const closeDetailsBtn = document.getElementById('closeDetailsBtn');

function showDetailsPanel(title, items) {
    detailsTitle.textContent = title;
    detailsContent.innerHTML = items.map(item => `<div class="details-item">${item}</div>`).join('');
    detailsPanel.classList.remove('hidden');
}
function hideDetailsPanel() {
    detailsPanel.classList.add('hidden');
}
closeDetailsBtn.addEventListener('click', hideDetailsPanel);
document.addEventListener('click', (e) => {
    if (!detailsPanel.contains(e.target) && e.target !== document.getElementById('litersDispensedBlock') && e.target !== document.getElementById('totalNeededBlock')) {
        hideDetailsPanel();
    }
});

// Обработчики кнопок статистики
document.getElementById('litersDispensedBlock').addEventListener('click', (e) => {
    e.stopPropagation();
    if (refuelLog.length === 0) {
        tg.showAlert('Нет заправленных машин');
        return;
    }
    const items = refuelLog.map(entry => 
        `<span>${entry.plate} ${entry.model}</span> <strong>${entry.liters} л</strong> <span style="font-size:11px">${entry.time}</span>`
    );
    showDetailsPanel('Слито литров', items);
});

document.getElementById('totalNeededBlock').addEventListener('click', (e) => {
    e.stopPropagation();
    const needed = allRequests.filter(r => r.status !== 'done');
    if (needed.length === 0) {
        tg.showAlert('Нет активных заявок');
        return;
    }
    const items = needed.map(r => {
        const lack = ((100 - r.fuelLevel) / 100 * 50).toFixed(1);
        return `<span>${r.licensePlate} ${r.carModel}</span> <strong>${lack} л</strong>`;
    });
    showDetailsPanel('На зоне требуется', items);
});

// Загрузка заявок
async function loadRequests() {
    try {
        const res = await fetch('/api/requests');
        allRequests = await res.json();
        renderMarkers(allRequests);
        updateAccountStats();
    } catch (e) { console.error(e); }
}

// Функции для маркеров и попапов (как прежде)
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
    if (isActive) gradient = '#000000';
    else {
        const color = markerColor(req.fuelLevel);
        gradient = `radial-gradient(circle at 30% 30%, ${lightenColor(color,0.4)}, ${color})`;
    }
    return L.divIcon({
        html: `<div style="background:${gradient}; width:18px; height:18px; border-radius:50%; border:2px solid white; box-shadow:0 0 6px rgba(0,0,0,0.6),0 0 0 2px rgba(255,255,255,0.3);"></div>`,
        iconSize: [22,22], iconAnchor: [11,11], className: ''
    });
}

function createPopupContent(req) {
    const container = document.createElement('div');
    container.className = 'popup-pin';
    const body = document.createElement('div'); body.className = 'popup-pin-body';
    const fill = document.createElement('div'); fill.className = 'popup-pin-fill';
    fill.style.height = req.fuelLevel + '%'; fill.style.setProperty('--fuel-color', markerColor(req.fuelLevel));
    const bubbles = document.createElement('div'); bubbles.className = 'popup-pin-bubbles';
    for (let i=0; i<4; i++) { const b = document.createElement('div'); b.className = 'popup-bubble'; bubbles.appendChild(b); }
    const model = document.createElement('div'); model.className = 'popup-model'; model.textContent = req.carModel;
    const plate = document.createElement('div'); plate.className = 'popup-plate'; plate.textContent = req.licensePlate;
    const percent = document.createElement('div'); percent.className = 'popup-percent'; percent.textContent = req.fuelLevel + '%';
    body.appendChild(fill); body.appendChild(bubbles); body.appendChild(model); body.appendChild(plate); body.appendChild(percent);
    const tip = document.createElement('div'); tip.className = 'popup-pin-tip';
    container.appendChild(body); container.appendChild(tip);
    return container;
}

// Панель действий
const actionPanel = document.getElementById('actionPanel');
const acceptBtn = document.getElementById('acceptBtn');
const routeBtn = document.getElementById('routeBtn');
const photoSearchBtn = document.getElementById('photoSearchBtn');

function showActionPanel(req, marker) {
    if (currentTaskRequest) { acceptBtn.style.display = 'none'; }
    else { acceptBtn.style.display = 'block'; acceptBtn.onclick = () => startTask(req, marker); }
    actionPanel.classList.remove('hidden');
    routeBtn.onclick = () => {
        const coords = `${req.lat}, ${req.lng}`;
        if (navigator.clipboard) navigator.clipboard.writeText(coords).then(() => tg.showAlert('Координаты скопированы'));
        else tg.showAlert(`Координаты: ${coords}`);
    };
    photoSearchBtn.onclick = () => tg.showAlert(`Поиск фото "${req.carModel}" появится позже`);
}
function hideActionPanel() { actionPanel.classList.add('hidden'); acceptBtn.onclick = routeBtn.onclick = photoSearchBtn.onclick = null; }

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
    if (currentTaskRequest) navigator.clipboard.writeText(currentTaskRequest.licensePlate).then(() => tg.showAlert('Номер скопирован'));
});
copyCoordsBtn.addEventListener('click', () => {
    if (currentTaskRequest) {
        const c = `${currentTaskRequest.lat}, ${currentTaskRequest.lng}`;
        navigator.clipboard.writeText(c).then(() => tg.showAlert('Координаты скопированы'));
    }
});

closeTaskBtn.addEventListener('click', () => {
    if (!currentTaskRequest) return;
    const liters = parseFloat(litersInput.value);
    if (isNaN(liters) || liters <= 0) { tg.showAlert('Введите корректный литраж'); return; }
    completeTask('closed', liters);
});
cancelTaskBtn.addEventListener('click', () => { if (confirm('Отменить заявку?')) completeTask('cancelled'); });

function completeTask(reason, liters = 0) {
    if (reason === 'closed' && currentTaskRequest) {
        // Списание из текущего топлива
        fuelTanks[currentFuelType] = Math.max(0, fuelTanks[currentFuelType] - liters);
        carsRefueled++;
        litersDispensed += liters;
        refuelLog.push({
            model: currentTaskRequest.carModel,
            plate: currentTaskRequest.licensePlate,
            liters: liters,
            time: new Date().toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
        });
        currentTaskRequest.status = 'done';
        if (activeTaskMarker) { map.removeLayer(activeTaskMarker); activeTaskMarker = null; }
        allRequests = allRequests.filter(r => r.id !== currentTaskRequest.id);
        renderMarkers(allRequests);
    }
    updateAccountStats();
    taskCarModel.textContent = ''; taskPlate.textContent = ''; taskCoords.textContent = ''; taskId.textContent = '';
    litersInput.value = ''; commentInput.value = ''; photoBeforeInput.value = ''; photoAfterInput.value = '';
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
    segBtns.forEach(b => b.classList.remove('active')); workBtn.classList.add('active');
    hideActionPanel();
    marker.setIcon(createMarkerIcon(req, true));
    map.closePopup();
    tg.showAlert(`Заявка #${req.id} принята в работу`);
}

function renderMarkers(requests) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    requests.forEach(req => {
        const isActive = currentTaskRequest && req.id === currentTaskRequest.id;
        const icon = isActive ? createMarkerIcon(req, true) : createMarkerIcon(req);
        const marker = L.marker([req.lat, req.lng], { icon: icon }).addTo(map);
        marker.bindPopup(createPopupContent(req));
        marker.on('popupopen', () => {
            map.panTo([req.lat, req.lng], { animate: true, duration: 0.5 });
            showActionPanel(req, marker);
            if (userLocation) buildRoute({ lat: userLocation.lat, lng: userLocation.lng }, { lat: req.lat, lng: req.lng });
        });
        marker.on('popupclose', () => { hideActionPanel(); clearRoute(); });
        markers.push(marker);
    });
    if (activeTaskMarker && !allRequests.find(r => r.id === currentTaskRequest?.id)) {
        activeTaskMarker = null; taskLocationBtn.classList.remove('visible');
    }
}

loadRequests();

const style = document.createElement('style');
style.textContent = `.leaflet-popup-content-wrapper { background: transparent !important; box-shadow: none !important; backdrop-filter: none !important; } .leaflet-popup-tip { display: none; }`;
document.head.appendChild(style);

map.on('click', () => hideActionPanel());
