const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

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

// Кастомная иконка маркера (кружок с эмодзи)
const fuelIcon = L.divIcon({
    html: '<div style="background: var(--tg-accent, #2ea6ff); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.3); font-size: 18px;">⛽</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    className: ''
});

let allRequests = [];
let markers = [];

const filterButtons = document.querySelectorAll('.filter-btn');

async function loadRequests() {
    try {
        const res = await fetch('/api/requests');
        allRequests = await res.json();
        applyFilter('all');
    } catch (e) {
        console.error('Ошибка загрузки', e);
        document.getElementById('request-list').innerHTML = 'Ошибка загрузки данных';
    }
}

function applyFilter(filter) {
    currentFilter = filter;
    filterButtons.forEach(b => b.classList.remove('active'));
    document.querySelector(`.filter-btn[data-filter="${filter}"]`).classList.add('active');

    const filtered = filter === 'all' ? allRequests : allRequests.filter(r => r.status === filter);
    renderMarkers(filtered);
    renderList(filtered);
}

function renderMarkers(requests) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    requests.forEach(req => {
        const marker = L.marker([req.lat, req.lng], { icon: fuelIcon })
            .addTo(map)
            .bindPopup(`
                <div style="font-size:14px; line-height:1.4;">
                    <b>${req.carModel}</b><br>
                    Топливо: <span style="color:${req.fuelLevel < 15 ? '#ff3b30' : '#34c759'}">${req.fuelLevel}%</span><br>
                    ${req.address}
                </div>
            `);
        marker.on('click', () => {
            map.setView([req.lat, req.lng], 16, { animate: true, duration: 0.5 });
        });
        markers.push(marker);
    });
}

function renderList(requests) {
    const list = document.getElementById('request-list');
    if (requests.length === 0) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--tg-hint)">Нет заявок по фильтру</div>';
        return;
    }
    list.innerHTML = requests.map(r => `
        <div class="request-card" onclick="focusOnRequest(${r.lat},${r.lng})">
            <div class="request-info">
                <span class="car-name">${r.carModel}</span>
                <span class="address">${r.address}</span>
                <div class="fuel-bar">
                    <div class="fuel-fill" style="width:${r.fuelLevel}%"></div>
                </div>
            </div>
            <span class="status-badge status-${r.status}">${getStatusText(r.status)}</span>
        </div>
    `).join('');
}

function getStatusText(status) {
    const mapStatus = { active: 'Срочно', in_progress: 'В работе', done: 'Готово' };
    return mapStatus[status] || status;
}

function focusOnRequest(lat, lng) {
    map.setView([lat, lng], 16, { animate: true, duration: 0.5 });
    // Небольшая подсветка маркера (если нужно)
}

// Обработчики фильтров
filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        applyFilter(btn.dataset.filter);
    });
});

// Загружаем и рендерим
loadRequests();
