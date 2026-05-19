const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// PWA Install Prompt
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  setTimeout(() => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((result) => {
        console.log("PWA install:", result.outcome);
        deferredPrompt = null;
      });
    }
  }, 10000); // Показать через 10 секунд
});

// --- Авторизация ---
const loginView = document.getElementById('loginView');
const mapView = document.getElementById('mapView');
const accountView = document.getElementById('accountView');
const xgView = document.getElementById('xgView');
const bottomPanel = document.getElementById('bottomPanel');
let loggedIn = false;
let previousViewId = 'accountView';
let shiftStart = null;

function tryAutoLogin() {
    const stored = localStorage.getItem('refuel_loggedIn');
    loggedIn = stored === 'true';
    if (loggedIn) {
        loginView.classList.remove('active');
        mapView.classList.remove('active');
        accountView.classList.add('active');
        bottomPanel.style.display = 'flex';
        document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.seg-btn[data-view="accountView"]').classList.add('active');
        if (!map) initMap();
        loadRequests();
        // Инициализация начала смены
        const savedShift = localStorage.getItem('shiftStart');
        if (savedShift) {
            shiftStart = parseInt(savedShift);
        } else {
            shiftStart = Date.now();
            localStorage.setItem('shiftStart', shiftStart);
        }
        updateXgStats();
        setInterval(updateXgStats, 60000); // обновление каждую минуту
    } else {
        loginView.classList.add('active');
        mapView.classList.remove('active');
        accountView.classList.remove('active');
        bottomPanel.style.display = 'none';
    }
}

document.getElementById('loginBtn').addEventListener('click', () => {
    const acc = document.getElementById('loginAcc').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    if (acc === 'admin' && pass === 'admin') {
        localStorage.setItem('refuel_loggedIn', 'true');
        loggedIn = true;
        loginView.classList.remove('active');
        mapView.classList.remove('active');
        accountView.classList.add('active');
        bottomPanel.style.display = 'flex';
        document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.seg-btn[data-view="accountView"]').classList.add('active');
        if (!map) initMap();
        loadRequests();
        const savedShift = localStorage.getItem('shiftStart');
        if (savedShift) {
            shiftStart = parseInt(savedShift);
        } else {
            shiftStart = Date.now();
            localStorage.setItem('shiftStart', shiftStart);
        }
        updateXgStats();
        setInterval(updateXgStats, 60000);
    } else {
        document.getElementById('loginError').classList.remove('hidden');
    }
});

// Завершение смены
document.getElementById('menuLogout').addEventListener('click', () => {
    localStorage.removeItem('refuel_loggedIn');
    localStorage.removeItem('shiftStart');
    shiftStart = null;
    loggedIn = false;
    loginView.classList.add('active');
    mapView.classList.remove('active');
    accountView.classList.remove('active');
    xgView.classList.remove('active');
    bottomPanel.style.display = 'none';
    if (map) {
        map.remove();
        map = null;
    }
    allRequests = [];
    markers = [];
    carsRefueled = 0;
    litersDispensed = 0;
    refuelLog.length = 0;
    fuelTanks.ai92 = 210;
    fuelTanks.dt = 600;
    fuelTanks.ai95 = 0;
    updateAccountStats();
    document.getElementById('settingsMenu').classList.add('hidden');
});

// Глобальные переменные
let map, userMarker, accuracyCircle, userLocation;
let currentRouteLayer;
let allRequests = [], markers = [];
let carsRefueled = 0, litersDispensed = 0;
const refuelLog = [];
const fuelTanks = { ai92: 210, dt: 600, ai95: 0 };
const maxFuel = { ai92: 320, dt: 1000, ai95: 0 };
let currentFuelType = 'ai92';
let currentTaskRequest = null, activeTaskMarker = null;
let lastClickedCoords = null;
let currentPopupRequest = null;
let currentPopupMarker = null;
const segBtns = document.querySelectorAll('.seg-btn');
const views = document.querySelectorAll('.view');
const workBtn = document.getElementById('workBtn');
const taskLocationBtn = document.getElementById('taskLocationBtn');

// Пульт Hardmode
const hardmodeOnBtn = document.getElementById('hardmodeOnBtn');
const hardmodeOffBtn = document.getElementById('hardmodeOffBtn');
let hardmode = false;
hardmodeOnBtn.classList.remove('active');
hardmodeOffBtn.classList.add('active');

hardmodeOnBtn.addEventListener('click', () => {
    if (hardmode) return;
    hardmode = true;
    hardmodeOnBtn.classList.add('active');
    hardmodeOffBtn.classList.remove('active');
    tg.showAlert('Hardmode включён');
});
hardmodeOffBtn.addEventListener('click', () => {
    if (!hardmode) return;
    hardmode = false;
    hardmodeOffBtn.classList.add('active');
    hardmodeOnBtn.classList.remove('active');
    tg.showAlert('Hardmode выключен');
});

// Режим сложного маршрута
let routeBuilderMode = false;
let routeBuilderPoints = [];
const MAX_ROUTE_POINTS = 10;
const routeBuilderBtn = document.getElementById('routeBuilderBtn');

routeBuilderBtn.addEventListener('click', () => {
    if (!routeBuilderMode) {
        routeBuilderMode = true;
        routeBuilderBtn.classList.add('active');
        routeBuilderPoints = [];
        tg.showAlert('Режим сложного маршрута включён. Выберите до 10 заявок. Нажмите повторно для построения.');
    } else {
        routeBuilderBtn.classList.remove('active');
        routeBuilderMode = false;
        if (routeBuilderPoints.length >= 1 && userLocation) {
            const points = [userLocation.lat, userLocation.lng].join(',') + '~' +
                routeBuilderPoints.map(p => `${p.lat},${p.lng}`).join('~');
            const url = `https://yandex.ru/maps/?rtt=auto&rtext=${points}`;
            window.open(url, '_blank');
        } else if (routeBuilderPoints.length >= 1 && !userLocation) {
            tg.showAlert('Местоположение не определено');
        } else {
            tg.showAlert('Режим сложного маршрута выключен');
        }
        markers.forEach(m => {
            if (!m.req) return;
            const isActive = currentTaskRequest && m.req.id === currentTaskRequest.id;
            m.setIcon(createMarkerIcon(m.req, isActive, false));
        });
        routeBuilderPoints = [];
    }
});

function switchView(viewId) {
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (viewId === 'mapView' && map) setTimeout(() => map.invalidateSize(), 100);
    if (viewId !== 'mapView' && map) {
        map.closePopup();
        hideActionPanel();
        clearRoute();
    }
}

// Обработчик для перехода в XG
document.getElementById('xgBlock').addEventListener('click', () => {
    previousViewId = Array.from(views).find(v => v.classList.contains('active'))?.id || 'accountView';
    views.forEach(v => v.classList.remove('active'));
    xgView.classList.add('active');
    updateXgStats();
});
document.getElementById('xgBackBtn').addEventListener('click', () => {
    xgView.classList.remove('active');
    document.getElementById(previousViewId).classList.add('active');
    if (previousViewId === 'mapView' && map) map.invalidateSize();
});

segBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const viewId = btn.dataset.view;
        if (!viewId) return;
        segBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        switchView(viewId);
    });
});

function initMap() {
    map = L.map('map', {
        center: [59.9343, 30.3351],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
        updateWhenIdle: false,
        updateWhenZooming: false
    });
    L.tileLayer('https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: 'Google' }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (pos) => {
                const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
                if (userMarker) map.removeLayer(userMarker);
                if (accuracyCircle) map.removeLayer(accuracyCircle);
                userMarker = L.circleMarker(latlng, { radius: 8, fillColor: '#007aff', fillOpacity: 1, color: 'white', weight: 2, opacity: 1 }).addTo(map);
                accuracyCircle = L.circle(latlng, { radius: pos.coords.accuracy, fillColor: '#007aff', fillOpacity: 0.15, color: '#007aff', weight: 1, opacity: 0.3 }).addTo(map);
                userLocation = latlng;
            },
            (err) => console.warn('Геолокация недоступна', err.message),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
    }

    document.getElementById('locationBtn').addEventListener('click', () => {
        if (!userLocation) return tg.showAlert('Местоположение не определено');
        map.setView(userLocation, map.getZoom(), { animate: true, duration: 0.5 });
    });

    document.getElementById('panoramaBtn').addEventListener('click', () => {
        if (!lastClickedCoords) {
            tg.showAlert('Сначала нажмите на заявку');
            return;
        }
        const url = `https://yandex.ru/maps/?ll=${lastClickedCoords.lng},${lastClickedCoords.lat}&z=17&mode=panorama&panorama%5Bpoint%5D=${lastClickedCoords.lng},${lastClickedCoords.lat}`;
        window.open(url, '_blank');
    });

    taskLocationBtn.addEventListener('click', () => {
        if (!activeTaskMarker) { tg.showAlert('Нет активной заявки'); return; }
        const latlng = activeTaskMarker.getLatLng();
        map.panTo(latlng, { animate: true, duration: 0.5 });
        map.closePopup();
        activeTaskMarker.openPopup();
    });
}

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

function formatLicensePlate(licensePlate) {
    const parts = licensePlate.split(' ');
    const base = parts.length > 0 ? parts[0] : licensePlate;
    const region = parts.length > 1 ? parts[1] : '';
    let html = `<span>${base}</span>`;
    if (region) {
        html += `<span style="display:flex;align-items:center;gap:2px;"> ${region} <span class="plate-flag">🇷🇺</span></span>`;
    } else {
        html += ` <span class="plate-flag">🇷🇺</span>`;
    }
    return `<div class="plate-display">${html}</div>`;
}

function updateAccountStats() {
    updateTank('ai92');
    updateTank('dt');
    updateTank('ai95');
    document.getElementById('litersDispensed').textContent = litersDispensed + ' л';
    const totalNeeded = allRequests.filter(r => r.status !== 'done').reduce((sum, r) => sum + ((100 - r.fuelLevel) / 100) * 50, 0);
    document.getElementById('totalNeeded').textContent = totalNeeded.toFixed(1) + ' л';
    updateXgStats(); // обновляем XG при каждом изменении
}

function updateTank(type) {
    const fuel = fuelTanks[type];
    const max = maxFuel[type];
    const percentage = Math.min(100, max > 0 ? (fuel / max) * 100 : 0);
    const fillEl = document.getElementById(`fill${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (fillEl) {
        fillEl.style.height = percentage + '%';
        let color;
        if (percentage <= 15) color = '#ff3b30';
        else if (percentage <= 25) color = '#ff9500';
        else color = '#2ecc71';
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

// XG Водителя
const RATES_DAY = [
    { max: 1199, rate: 2.90 },
    { max: 1699, rate: 3.20 },
    { max: 1999, rate: 3.70 },
    { max: Infinity, rate: 4.00 }
];
const RATES_NIGHT = [
    { max: 1699, rate: 2.70 },
    { max: 2099, rate: 3.00 },
    { max: 2599, rate: 3.30 },
    { max: Infinity, rate: 3.50 }
];

function getShiftInfo() {
    const now = new Date();
    const hour = now.getHours();
    let isDay = hour >= 7 && hour < 19;
    let shiftEnd = new Date(now);
    if (isDay) {
        shiftEnd.setHours(19, 0, 0, 0);
    } else {
        shiftEnd.setHours(7, 0, 0, 0);
        if (hour >= 19) shiftEnd.setDate(shiftEnd.getDate() + 1); // если уже после 19, то завтра 7 утра
    }
    const timeLeftMs = shiftEnd - now;
    const hoursLeft = Math.max(0, timeLeftMs / 3600000);
    return { isDay, shiftEnd, hoursLeft, timeLeftMs };
}

function getCurrentRateInfo(totalLiters, isDay) {
    const rates = isDay ? RATES_DAY : RATES_NIGHT;
    let currentRate = rates[0].rate;
    let nextLevel = null;
    for (let i = 0; i < rates.length; i++) {
        if (totalLiters <= rates[i].max) {
            currentRate = rates[i].rate;
            if (i < rates.length - 1) {
                nextLevel = {
                    from: rates[i].max + 1,
                    to: rates[i+1].max === Infinity ? '∞' : rates[i+1].max,
                    rate: rates[i+1].rate,
                    need: (rates[i].max + 1) - totalLiters
                };
            }
            break;
        }
    }
    return { currentRate, nextLevel };
}

function updateXgStats() {
    if (!shiftStart) return;
    const { isDay, hoursLeft, timeLeftMs } = getShiftInfo();
    const totalLiters = litersDispensed;
    const cars = carsRefueled;
    const elapsedHours = Math.max(0.1, (Date.now() - shiftStart) / 3600000);
    const pace = totalLiters / elapsedHours; // л/ч
    const forecast = pace * hoursLeft;
    const { currentRate, nextLevel } = getCurrentRateInfo(totalLiters, isDay);

    document.getElementById('xgShiftType').textContent = isDay ? 'Дневная (07-19)' : 'Ночная (19-07)';
    const h = Math.floor(hoursLeft);
    const m = Math.floor((hoursLeft - h) * 60);
    document.getElementById('xgTimeLeft').textContent = `${h} ч ${m} мин`;
    document.getElementById('xgLiters').textContent = totalLiters + ' л';
    document.getElementById('xgCars').textContent = cars;
    document.getElementById('xgPace').textContent = pace.toFixed(1) + ' л/ч';
    document.getElementById('xgCurrentRate').textContent = currentRate.toFixed(2) + ' ₽/л';
    document.getElementById('xgForecast').textContent = forecast.toFixed(0) + ' л';

    // Следующий уровень
    if (nextLevel) {
        document.getElementById('xgNextLevel').textContent = `${nextLevel.from}-${nextLevel.to} л (${nextLevel.rate} ₽/л)`;
        document.getElementById('xgToNext').textContent = `${nextLevel.need} л`;
    } else {
        document.getElementById('xgNextLevel').textContent = 'Максимум';
        document.getElementById('xgToNext').textContent = '-';
    }

    // Прогресс-бар: процент от верхней границы текущей ставки или от 2000/2600
    const rates = isDay ? RATES_DAY : RATES_NIGHT;
    const maxTarget = isDay ? 2000 : 2600;
    const progress = Math.min(100, (totalLiters / maxTarget) * 100);
    document.getElementById('xgProgressFill').style.width = progress + '%';
    document.getElementById('xgProgressText').textContent = progress.toFixed(1) + '%';
    document.getElementById('xgTarget').textContent = `${maxTarget} л (макс. ставка)`;

    // Таблица ставок
    const tableContainer = document.getElementById('xgRatesTable');
    let html = '<table><tr><th>Объём, л</th><th>Ставка, ₽/л</th></tr>';
    rates.forEach((r, i) => {
        const range = r.max === Infinity ? `≥${rates[i-1].max+1}` : `0 – ${r.max}`;
        const isCurrent = totalLiters <= r.max && (i === 0 || totalLiters > rates[i-1].max);
        html += `<tr class="${isCurrent ? 'highlight' : ''}"><td>${range}</td><td>${r.rate.toFixed(2)}</td></tr>`;
    });
    html += '</table>';
    tableContainer.innerHTML = html;

    // Обновление значения в аккаунте
    const xgValueEl = document.getElementById('xgValue');
    if (xgValueEl) {
        xgValueEl.textContent = progress.toFixed(0) + '%';
    }
}

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
document.getElementById('customRefuelBtn').addEventListener('click', () => {
    const input = document.getElementById('customLitersInput');
    const liters = parseInt(input.value, 10);
    if (isNaN(liters) || liters <= 0) { tg.showAlert('Введите корректное количество литров'); return; }
    const tankType = currentFuelType;
    const max = maxFuel[tankType];
    const newFuel = Math.min(fuelTanks[tankType] + liters, max);
    fuelTanks[tankType] = newFuel;
    updateAccountStats();
    tg.showAlert(`Канистра ${tankType.toUpperCase()} пополнена на ${liters} л`);
    input.value = '';
});

// Карусель
const carousel = document.getElementById('tankCarousel');
let touchStartX = 0, touchEndX = 0;
carousel.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
carousel.addEventListener('touchend', (e) => { touchEndX = e.changedTouches[0].screenX; handleSwipe(); });
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

// Шестерёнка
const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); settingsMenu.classList.toggle('hidden'); });
document.addEventListener('click', (e) => { if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) settingsMenu.classList.add('hidden'); });
document.getElementById('menuSupport').addEventListener('click', () => { tg.showAlert('Поддержка: звоните диспетчеру'); settingsMenu.classList.add('hidden'); });
document.getElementById('menuInstructions').addEventListener('click', () => { tg.showAlert('Инструкция по заправке...'); settingsMenu.classList.add('hidden'); });
document.getElementById('menuSOS').addEventListener('click', () => { tg.showAlert('SOS: помощь уже в пути'); settingsMenu.classList.add('hidden'); });

// Детали
const detailsPanel = document.getElementById('detailsPanel');
const detailsContent = document.getElementById('detailsContent');
function showDetailsPanel(items) {
    detailsContent.innerHTML = items.map(item => `<div class="details-item">${item}</div>`).join('');
    detailsPanel.classList.remove('hidden');
}
function hideDetailsPanel() { detailsPanel.classList.add('hidden'); }
document.addEventListener('click', (e) => { if (!detailsPanel.contains(e.target) && e.target !== document.getElementById('litersDispensedBlock') && e.target !== document.getElementById('totalNeededBlock')) hideDetailsPanel(); });
document.getElementById('litersDispensedBlock').addEventListener('click', (e) => {
    e.stopPropagation();
    if (refuelLog.length === 0) { tg.showAlert('Нет заправленных машин'); return; }
    const items = refuelLog.map(entry => `<span>${entry.plate} ${entry.model}</span> <strong>${entry.liters} л</strong> <span style="font-size:11px">${entry.time}</span>`);
    showDetailsPanel(items);
});
document.getElementById('totalNeededBlock').addEventListener('click', (e) => {
    e.stopPropagation();
    const needed = allRequests.filter(r => r.status !== 'done');
    if (needed.length === 0) { tg.showAlert('Нет активных заявок'); return; }
    const items = needed.map(r => {
        const lack = ((100 - r.fuelLevel) / 100 * 50).toFixed(1);
        return `<span>${r.licensePlate} ${r.carModel}</span> <strong>${lack} л</strong>`;
    });
    showDetailsPanel(items);
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
    return '#2ecc71';
}
function lightenColor(hex, f) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const to = c => Math.min(255, Math.floor(c + (255-c)*f));
    return `rgb(${to(r)},${to(g)},${to(b)})`;
}
function createMarkerIcon(req, isActive = false, isRoutePoint = false) {
    let gradient;
    if (isActive) gradient = '#000000';
    else if (isRoutePoint) gradient = '#007aff';
    else {
        const color = markerColor(req.fuelLevel);
        gradient = `radial-gradient(circle at 30% 30%, ${lightenColor(color,0.4)}, ${color})`;
    }
    return L.divIcon({
        html: `<div style="background:${gradient}; width:18px; height:18px; border-radius:50%; border:2px solid white; box-shadow:0 0 6px rgba(0,0,0,0.6),0 0 0 2px rgba(255,255,255,0.3);"></div>`,
        iconSize: [22,22], iconAnchor: [11,11], className: ''
    });
}

// ===== ПОПАП 130px =====
function createPopupContent(req) {
    const container = document.createElement('div');
    container.className = 'popup-dashboard';

    const modelRow = document.createElement('div');
    modelRow.className = 'dash-model-row';
    const modelText = document.createElement('span');
    modelText.textContent = req.carModel;
    modelRow.appendChild(modelText);

    if (req.longRent) {
        const rentBadge = document.createElement('span');
        rentBadge.className = 'dash-rent-badge';
        rentBadge.textContent = 'Rent';
        modelRow.appendChild(rentBadge);
    }

    const plateDiv = document.createElement('div');
    plateDiv.className = 'dash-plate';
    const plateText = document.createElement('span');
    plateText.className = 'dash-plate-text';
    plateText.textContent = req.licensePlate;
    plateDiv.appendChild(plateText);

    const fuelSection = document.createElement('div');
    fuelSection.className = 'dash-fuel-section';
    const fuelBarBg = document.createElement('div');
    fuelBarBg.className = 'dash-fuel-bar-bg';
    const fuelBarFill = document.createElement('div');
    fuelBarFill.className = 'dash-fuel-bar-fill';
    fuelBarFill.style.width = req.fuelLevel + '%';
    fuelBarBg.appendChild(fuelBarFill);
    const fuelPercent = document.createElement('span');
    fuelPercent.className = 'dash-fuel-percent';
    fuelPercent.textContent = req.fuelLevel + '%';
    fuelSection.appendChild(fuelBarBg);
    fuelSection.appendChild(fuelPercent);

    container.appendChild(modelRow);
    container.appendChild(plateDiv);
    container.appendChild(fuelSection);
    return container;
}

// Панель действий
const actionPanel = document.getElementById('actionPanel');
const acceptBtn = document.getElementById('acceptBtn');
const routeBtn = document.getElementById('routeBtn');
const photoSearchBtn = document.getElementById('photoSearchBtn');

let routeMode = 'route';
let swiped = false;

const slider = document.createElement('div');
slider.className = 'route-slider';
routeBtn.appendChild(slider);

function updateRouteButton() {
    if (routeMode === 'route') {
        slider.style.transform = 'translateX(0)';
        routeBtn.textContent = 'Построить маршрут';
        routeBtn.classList.add('route-yandex');
        routeBtn.classList.remove('route-copy');
    } else {
        slider.style.transform = 'translateX(100%)';
        routeBtn.textContent = 'Скопировать координаты';
        routeBtn.classList.remove('route-yandex');
        routeBtn.classList.add('route-copy');
    }
}

acceptBtn.addEventListener('click', () => {
    if (!currentPopupRequest || !currentPopupMarker) return;
    startTask(currentPopupRequest, currentPopupMarker);
    hideActionPanel();
});

routeBtn.addEventListener('click', (e) => {
    if (swiped) {
        e.preventDefault();
        e.stopPropagation();
        swiped = false;
        return;
    }
    if (!currentPopupRequest) return;
    if (routeMode === 'route') {
        if (userLocation) {
            const url = `https://yandex.ru/maps/?rtt=auto&rtext=${userLocation.lat},${userLocation.lng}~${currentPopupRequest.lat},${currentPopupRequest.lng}`;
            window.open(url, '_blank');
        } else {
            tg.showAlert('Местоположение не определено');
        }
    } else {
        const coords = `${currentPopupRequest.lat}, ${currentPopupRequest.lng}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(coords).then(() => tg.showAlert('Координаты скопированы'));
        } else {
            tg.showAlert(`Координаты: ${coords}`);
        }
    }
});

photoSearchBtn.addEventListener('click', () => {
    if (currentPopupRequest) {
        tg.showAlert(`Поиск фото "${currentPopupRequest.carModel}" появится позже`);
    }
});

let swipeStartX = 0;
routeBtn.addEventListener('touchstart', (e) => {
    swiped = false;
    swipeStartX = e.changedTouches[0].screenX;
}, { passive: true });

routeBtn.addEventListener('touchmove', (e) => {
    const diff = e.changedTouches[0].screenX - swipeStartX;
    if (Math.abs(diff) > 5) swiped = true;
    const maxOffset = routeBtn.offsetWidth * 0.5;
    let offset = Math.max(0, Math.min(maxOffset, diff));
    slider.style.transform = `translateX(${offset}px)`;
});

routeBtn.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].screenX - swipeStartX;
    const threshold = routeBtn.offsetWidth * 0.3;
    if (diff > threshold) {
        routeMode = 'copy';
    } else {
        routeMode = 'route';
    }
    updateRouteButton();
});

updateRouteButton();

function showActionPanel(req, marker) {
    currentPopupRequest = req;
    currentPopupMarker = marker;
    acceptBtn.style.display = currentTaskRequest ? 'none' : 'block';
    actionPanel.classList.remove('hidden');
}
function hideActionPanel() {
    actionPanel.classList.add('hidden');
    currentPopupRequest = null;
    currentPopupMarker = null;
}

// Таймер
let timerInterval = null;
const TOTAL_SECONDS = 1200;
const timerWrapper = document.getElementById('timerWrapper');
const timerFill = document.getElementById('timerFill');
const timerText = document.getElementById('timerText');

function startTimer() {
    const startTime = Date.now();
    timerWrapper.style.display = 'block';
    updateTimer(startTime);
    timerInterval = setInterval(() => updateTimer(startTime), 1000);
}

function updateTimer(startTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = Math.max(0, TOTAL_SECONDS - elapsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    timerText.textContent = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
    const percent = (remaining / TOTAL_SECONDS) * 100;
    timerFill.style.width = percent + '%';
    if (percent > 50) {
        timerFill.style.background = '#2ecc71';
    } else if (percent > 20) {
        timerFill.style.background = '#ff9500';
    } else {
        timerFill.style.background = '#ff3b30';
    }
    if (remaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        tg.showAlert('Время вышло!');
    }
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerWrapper.style.display = 'none';
}

// Окно выполнения
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
const confirmLitersBtn = document.getElementById('confirmLitersBtn');
const commentInput = document.getElementById('commentInput');
const openDoorsBtn = document.getElementById('openDoorsBtn');
const closeDoorsBtn = document.getElementById('closeDoorsBtn');
const closeTaskBtn = document.getElementById('closeTaskBtn');
const cancelTaskBtn = document.getElementById('cancelTaskBtn');

const beforeHolder = { current: null };
const afterHolder = { current: null };

function applyStampAndGetUrl(file, callback) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height, 800);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);

        const timestamp = new Date().toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const driverName = 'Иван Петров';
        const truck = 'БелАЗ А123ВС 178';
        const taskModel = currentTaskRequest ? currentTaskRequest.carModel : '';
        const taskPlateVal = currentTaskRequest ? currentTaskRequest.licensePlate : '';
        const taskIdVal = currentTaskRequest ? currentTaskRequest.id : '';
        let geoText = 'Гео: -';
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                geoText = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
                drawAndFinalize();
            }, () => { drawAndFinalize(); });
        } else {
            drawAndFinalize();
        }
        function drawAndFinalize() {
            const stampWidth = size * 0.95;
            const stampHeight = size * 0.15;
            const x = (size - stampWidth) / 2;
            const y = size - stampHeight - 10;

            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 8;
            ctx.fillStyle = 'white';
            ctx.font = `bold ${size * 0.04}px sans-serif`;
            ctx.textAlign = 'center';
            const lines = [
                `${driverName}  |  ${truck}`,
                `${geoText}  |  Заявка №${taskIdVal}`,
                `${taskModel} · ${taskPlateVal}  |  ${timestamp}`
            ];
            const lineHeight = size * 0.045;
            lines.forEach((line, idx) => {
                ctx.fillText(line, size/2, y + 30 + idx * lineHeight);
            });

            const dataUrl = canvas.toDataURL('image/jpeg');
            URL.revokeObjectURL(url);
            callback(dataUrl);
        }
    };
    img.src = url;
}

const retakeSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

function setupPhotoButton(btn, input, fileHolder) {
    btn.addEventListener('click', () => {
        if (fileHolder.current) {
            const win = window.open();
            win.document.write(`<img src="${fileHolder.current}" style="max-width:100%;">`);
        } else {
            input.click();
        }
    });

    input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            fileHolder.current = file;

            applyStampAndGetUrl(file, (dataUrl) => {
                const img = document.createElement('img');
                img.src = dataUrl;
                btn.innerHTML = '';
                btn.appendChild(img);

                const retakeIcon = document.createElement('span');
                retakeIcon.style.cssText = 'position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.6);border-radius:50%;padding:4px;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center;';
                retakeIcon.innerHTML = retakeSVG;
                retakeIcon.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    input.click();
                });
                btn.appendChild(retakeIcon);
            });
        }
    });
}

setupPhotoButton(photoBeforeBtn, photoBeforeInput, beforeHolder);
setupPhotoButton(photoAfterBtn, photoAfterInput, afterHolder);

openDoorsBtn.addEventListener('click', () => tg.showAlert('Двери открыты'));
closeDoorsBtn.addEventListener('click', () => tg.showAlert('Двери закрыты'));
copyPlateBtn.addEventListener('click', () => { if (currentTaskRequest) navigator.clipboard.writeText(currentTaskRequest.licensePlate).then(() => tg.showAlert('Номер скопирован')); });
copyCoordsBtn.addEventListener('click', () => { if (currentTaskRequest) { const c = `${currentTaskRequest.lat}, ${currentTaskRequest.lng}`; navigator.clipboard.writeText(c).then(() => tg.showAlert('Координаты скопированы')); } });

function updateConfirmBtn() {
    const val = litersInput.value.trim();
    if (val && parseFloat(val) > 0) {
        confirmLitersBtn.classList.add('active');
    } else {
        confirmLitersBtn.classList.remove('active');
    }
}
litersInput.addEventListener('input', updateConfirmBtn);
confirmLitersBtn.addEventListener('click', () => {
    updateConfirmBtn();
    if (confirmLitersBtn.classList.contains('active')) {
        litersInput.blur();
        tg.showAlert('Литраж зафиксирован');
    } else {
        tg.showAlert('Введите корректный литраж');
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
    beforeHolder.current = null;
    afterHolder.current = null;
    photoBeforeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span class="photo-label">ДО</span>';
    photoAfterBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span class="photo-label">ПОСЛЕ</span>';
    confirmLitersBtn.classList.remove('active');
    litersInput.value = '';
    commentInput.value = '';
    currentTaskRequest = null;
    workBtn.classList.remove('visible');
    taskLocationBtn.classList.remove('visible');
    stopTimer();
    switchView('mapView');
    segBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('.seg-btn[data-view="mapView"]').classList.add('active');
    tg.showAlert(reason === 'closed' ? 'Заявка закрыта' : 'Заявка отменена');
}

function startTask(req, marker) {
    currentTaskRequest = req;
    activeTaskMarker = marker;
    taskCarModel.textContent = req.carModel;
    taskPlate.innerHTML = formatLicensePlate(req.licensePlate);
    taskCoords.textContent = `${req.lat}, ${req.lng}`;
    taskId.textContent = req.id;
    beforeHolder.current = null;
    afterHolder.current = null;
    photoBeforeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span class="photo-label">ДО</span>';
    photoAfterBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span class="photo-label">ПОСЛЕ</span>';
    litersInput.value = '';
    commentInput.value = '';
    confirmLitersBtn.classList.remove('active');
    workBtn.classList.add('visible');
    taskLocationBtn.classList.add('visible');
    switchView('workView');
    segBtns.forEach(b => b.classList.remove('active')); workBtn.classList.add('active');
    hideActionPanel();
    marker.setIcon(createMarkerIcon(req, true));
    map.closePopup();
    startTimer();
    tg.showAlert(`Заявка #${req.id} принята в работу`);
}

function handleMarkerClickInRouteMode(req, marker) {
    const existingIndex = routeBuilderPoints.findIndex(p => p.req.id === req.id);
    if (existingIndex !== -1) {
        routeBuilderPoints.splice(existingIndex, 1);
        marker.setIcon(createMarkerIcon(req, false, false));
    } else {
        if (routeBuilderPoints.length >= MAX_ROUTE_POINTS) {
            tg.showAlert(`Максимум ${MAX_ROUTE_POINTS} точек`);
            return;
        }
        routeBuilderPoints.push({ lat: req.lat, lng: req.lng, req });
        marker.setIcon(createMarkerIcon(req, false, true));
    }
}

function renderMarkers(requests) {
    if (!map) return;
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    requests.forEach(req => {
        const isActive = currentTaskRequest && req.id === currentTaskRequest.id;
        const isRoutePoint = routeBuilderPoints.some(p => p.req.id === req.id);
        const icon = createMarkerIcon(req, isActive, isRoutePoint);
        const marker = L.marker([req.lat, req.lng], { icon: icon }).addTo(map);
        marker.req = req;

        marker.bindPopup(createPopupContent(req));

        marker.on('popupopen', () => {
            lastClickedCoords = { lat: req.lat, lng: req.lng };

            if (routeBuilderMode) {
                handleMarkerClickInRouteMode(req, marker);
                map.closePopup();
            } else {
                map.panTo([req.lat, req.lng], { animate: true, duration: 0.5 });
                showActionPanel(req, marker);
                if (userLocation) buildRoute({ lat: userLocation.lat, lng: userLocation.lng }, { lat: req.lat, lng: req.lng });
            }
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

const style = document.createElement('style');
style.textContent = `.leaflet-popup-content-wrapper { background: transparent !important; box-shadow: none !important; backdrop-filter: none !important; } .leaflet-popup-tip { display: none; }`;
document.head.appendChild(style);

tryAutoLogin();
if (loggedIn) {
    if (!map) initMap();
    loadRequests();
}
map && map.on('click', () => hideActionPanel());
