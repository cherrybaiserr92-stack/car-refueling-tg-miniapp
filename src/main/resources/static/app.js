const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Переключение видов
const segBtns = document.querySelectorAll('.seg-btn');
const views = document.querySelectorAll('.view');
segBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const viewId = btn.dataset.view;
        segBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        views.forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        if (viewId === 'mapView') {
            setTimeout(() => map.invalidateSize(), 100);
        }
        // При уходе с карты закрываем попап и панель действий
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
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
}).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

let allRequests = [];
let markers = [];
let currentFilter = 'all';
let activeRequestId = null;

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

// Управление панелью действий
const actionPanel = document.getElementById('actionPanel');
const acceptBtn = document.getElementById('acceptBtn');
const routeBtn = document.getElementById('routeBtn');

function showActionPanel(req) {
    activeRequestId = req.id;
    actionPanel.classList.remove('hidden');
    // Назначаем обработчики (каждый раз новые, чтобы избежать дублирования)
    acceptBtn.onclick = () => {
        tg.showAlert(`Заявка #${req.id} принята в работу`);
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
    activeRequestId = null;
    actionPanel.classList.add('hidden');
    acceptBtn.onclick = null;
    routeBtn.onclick = null;
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
        });
        marker.on('popupclose', () => {
            hideActionPanel();
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

// Стилизация попапов (дополнительно, если не подхватилось)
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

// Закрываем панель действий при клике на карту (вне попапа)
map.on('click', () => {
    hideActionPanel();
});
