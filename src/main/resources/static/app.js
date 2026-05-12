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

const fuelIcon = L.icon({
    iconUrl: 'https://img.icons8.com/fluency/48/gas-station.png',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

let markers = [];
let currentFilter = 'all';

async function loadRequests() {
    try {
        const res = await fetch('/api/requests');
        const data = await res.json();
        renderRequests(data);
        renderList(data);
    } catch (e) {
        console.error('Ошибка загрузки заявок', e);
    }
}

function renderRequests(requests) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    requests.forEach(req => {
        if (currentFilter !== 'all' && req.status !== currentFilter) return;
        const marker = L.marker([req.lat, req.lng], { icon: fuelIcon })
            .addTo(map)
            .bindPopup(`
                <b>${req.carModel}</b><br>
                Остаток: ${req.fuelLevel}%<br>
                ${req.address}<br>
                <span style="text-transform:uppercase">${req.status}</span>
            `);
        markers.push(marker);
    });
}

function renderList(requests) {
    const list = document.getElementById('request-list');
    list.innerHTML = requests.map(r => `
        <div class="request-card" onclick="focusOnRequest(${r.lat},${r.lng})">
            <div class="request-info">
                <span class="car-name">${r.carModel}</span>
                <span class="address">${r.address}</span>
                <div class="fuel-bar"><div class="fuel-fill" style="width:${r.fuelLevel}%"></div></div>
            </div>
            <span class="status-badge status-${r.status}">${getStatusText(r.status)}</span>
        </div>
    `).join('');
}

function getStatusText(status) {
    const map = { active: 'Новая', in_progress: 'В работе', done: 'Готово' };
    return map[status] || status;
}

function focusOnRequest(lat, lng) {
    map.setView([lat, lng], 16);
}

loadRequests();
