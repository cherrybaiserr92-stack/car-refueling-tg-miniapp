EOFconst tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Переключение вкладок
const tabButtons = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.view');

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const viewId = btn.dataset.view;
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        views.forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        if (viewId === 'mapView') {
            setTimeout(() => map.invalidateSize(), 100);
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

function createMarkerIcon(req) {
    const color = markerColor(req.fuelLevel);
    return L.divIcon({
        html: `<div style="background:${color}; width:28px; height:28px; border-radius:50%; box-shadow: 0 2px 10px rgba(0,0,0,0.5);"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        className: ''
    });
}

// Функция создания контента попапа с кнопками
function createPopupContent(req) {
    const container = document.createElement('div');
    container.style.minWidth = '160px';
    container.style.fontSize = '14px';
    container.style.lineHeight = '1.5';
    container.innerHTML = `
        <b>${req.carModel}</b><br>
        <span style="font-weight:700; font-size:16px;">${req.licensePlate}</span><br>
        <span style="color:${markerColor(req.fuelLevel)}">Топливо: ${req.fuelLevel}%</span><br>
    `;
    const btnGroup = document.createElement('div');
    btnGroup.style.marginTop = '8px';
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '6px';

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'popup-btn accept-btn';
    acceptBtn.textContent = 'Взять в работу';
    acceptBtn.addEventListener('click', () => {
        tg.showAlert(`Заявка #${req.id} принята в работу`);
    });

    const routeBtn = document.createElement('button');
    routeBtn.className = 'popup-btn route-btn';
    routeBtn.textContent = 'Скопировать координаты';
    routeBtn.addEventListener('click', () => {
        const coords = `${req.lat}, ${req.lng}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(coords).then(() => {
                tg.showAlert('Координаты скопированы');
            });
        } else {
            tg.showAlert(`Координаты: ${coords}`);
        }
    });

    btnGroup.appendChild(acceptBtn);
    btnGroup.appendChild(routeBtn);
    container.appendChild(btnGroup);
    return container;
}

function renderMarkers(requests) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    requests.forEach(req => {
        const marker = L.marker([req.lat, req.lng], { icon: createMarkerIcon(req) })
            .addTo(map);
        marker.bindPopup(createPopupContent(req));
        markers.push(marker);
    });
}

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
            document.querySelector('.tab-btn[data-view="mapView"]').click();
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

// Дополнительные стили для кнопок (на всякий случай, если не подгрузились из style.css)
const style = document.createElement('style');
style.textContent = `
    .popup-btn {
        flex: 1;
        padding: 8px 10px;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
        color: white;
        text-align: center;
    }
    .accept-btn { background: var(--tg-accent, #007aff); }
    .route-btn { background: rgba(255,255,255,0.15); }
    .leaflet-popup-content-wrapper {
        background: rgba(30,30,32,0.95) !important;
        backdrop-filter: blur(15px);
        color: white;
        border-radius: 12px;
    }
    .leaflet-popup-tip { background: rgba(30,30,32,0.95) !important; }
`;
document.head.appendChild(style);

