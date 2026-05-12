const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Переключение видов (Карта / Заявки)
const segBtns = document.querySelectorAll('.seg-btn');
const views = document.querySelectorAll('.view');
const mapView = document.getElementById('mapView');
const listView = document.getElementById('listView');
const workBtn = document.getElementById('workBtn');
let currentTaskRequest = null; // активная заявка

segBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const viewId = btn.dataset.view;
        if (!viewId) return; // у кнопки "В работе" нет data-view
        segBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        views.forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        if (viewId === 'mapView') {
            setTimeout(() => map.invalidateSize(), 100);
        }
        if (viewId !== 'mapView') {
            map.closePopup();
            hideActionPanel();
        }
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

let allRequests = [];
let markers = [];
let currentFilter = 'all';

// Фильтры
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

function createMarkerIcon(req) {
    const color = markerColor(req.fuelLevel);
    const gradient = `radial-gradient(circle at 30% 30%, ${lightenColor(color, 0.4)}, ${color})`;
    return L.divIcon({
        html: `<div style="background:${gradient}; width:20px; height:20px; border-radius:50%; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        className: ''
    });
}

function createPopupContent(req) {
    const container = document.createElement('div');
    container.className = 'popup-info';
    container.innerHTML = `
        <div class="car-line">${req.carModel} · ${req.licensePlate}</div>
        <div class="fuel-line" style="color:${markerColor(req.fuelLevel)}">Топливо: ${req.fuelLevel}%</div>
    `;
    return container;
}

// Панель действий
const actionPanel = document.getElementById('actionPanel');
const acceptBtn = document.getElementById('acceptBtn');
const routeBtn = document.getElementById('routeBtn');

function showActionPanel(req) {
    actionPanel.classList.remove('hidden');
    acceptBtn.onclick = () => {
        startTask(req);
    };
    routeBtn.onclick = () => {
        const coords = `${req.lat}, ${req.lng}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(coords).then(() => {
                tg.showAlert('Координаты скопированы');
            });
        } else {
            tg.showAlert(`Координаты: ${coords}`);
        }
    };
}

function hideActionPanel() {
    actionPanel.classList.add('hidden');
    acceptBtn.onclick = null;
    routeBtn.onclick = null;
}

// Модальное окно заявки
const taskModal = document.getElementById('taskModal');
const photoBeforeBtn = document.getElementById('photoBeforeBtn');
const photoAfterBtn = document.getElementById('photoAfterBtn');
const photoBeforeInput = document.getElementById('photoBeforeInput');
const photoAfterInput = document.getElementById('photoAfterInput');
const litersInput = document.getElementById('litersInput');
const openDoorsBtn = document.getElementById('openDoorsBtn');
const closeDoorsBtn = document.getElementById('closeDoorsBtn');
const closeTaskBtn = document.getElementById('closeTaskBtn');

photoBeforeBtn.addEventListener('click', () => photoBeforeInput.click());
photoAfterBtn.addEventListener('click', () => photoAfterInput.click());

// Обработчики загрузки фото (просто показываем уведомление)
photoBeforeInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) tg.showAlert('Фото "ДО" загружено');
});
photoAfterInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) tg.showAlert('Фото "ПОСЛЕ" загружено');
});

// Управление дверьми (заглушка)
openDoorsBtn.addEventListener('click', () => {
    tg.showAlert('Двери открыты');
});
closeDoorsBtn.addEventListener('click', () => {
    tg.showAlert('Двери закрыты');
});

// Закрытие заявки
closeTaskBtn.addEventListener('click', () => {
    taskModal.classList.add('hidden');
    workBtn.classList.remove('visible');
    // Сброс активной заявки
    currentTaskRequest = null;
    // Если активна карта, закрываем попап
    if (mapView.classList.contains('active')) {
        map.closePopup();
    }
});

// Запуск выполнения заявки
function startTask(req) {
    currentTaskRequest = req;
    // Показываем модальное окно
    taskModal.classList.remove('hidden');
    // Показываем кнопку "В работе"
    workBtn.classList.add('visible');
    // Скрываем панель действий
    hideActionPanel();
    // Закрываем попап маркера
    map.closePopup();
    // Сбрасываем поля
    litersInput.value = '';
    photoBeforeInput.value = '';
    photoAfterInput.value = '';
    tg.showAlert(`Заявка #${req.id} принята в работу`);
}

// Рендер маркеров
function renderMarkers(requests) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    requests.forEach(req => {
        const marker = L.marker([req.lat, req.lng], { icon: createMarkerIcon(req) }).addTo(map);
        marker.bindPopup(createPopupContent(req));
        marker.on('popupopen', () => showActionPanel(req));
        marker.on('popupclose', () => hideActionPanel());
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
            document.querySelector('.seg-btn[data-view="mapView"]').click();
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

// Дополнительные стили попапа (подстраховка)
const style = document.createElement('style');
style.textContent = `
    .leaflet-popup-content-wrapper {
        background: rgba(30,30,32,0.7) !important;
        backdrop-filter: blur(20px);
    }
    .leaflet-popup-tip {
        background: rgba(30,30,32,0.7) !important;
    }
`;
document.head.appendChild(style);

// Закрываем панель действий при клике на карту
map.on('click', () => {
    hideActionPanel();
});
