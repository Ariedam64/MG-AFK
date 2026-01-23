'use strict';

const cookieInput = document.getElementById('cookieInput');
const roomInput = document.getElementById('roomInput');
const toggleBtn = document.getElementById('toggleBtn');
const errorText = document.getElementById('errorText');
const statusChip = document.getElementById('statusChip');
const playersValue = document.getElementById('playersValue');
const uptimeValue = document.getElementById('uptimeValue');
const playerIdValue = document.getElementById('playerIdValue');
const playerNameValue = document.getElementById('playerNameValue');
const roomIdValue = document.getElementById('roomIdValue');
const weatherValue = document.getElementById('weatherValue');
const weatherIcon = document.getElementById('weatherIcon');
const petList = document.getElementById('petList');
const logList = document.getElementById('logList');
const logSearchInput = document.getElementById('logSearchInput');
const alertShopSelect = document.getElementById('alertShopSelect');
const alertNotifySelect = document.getElementById('alertNotifySelect');
const alertRows = document.getElementById('alertRows');
const shopSeedList = document.getElementById('shopSeedList');
const shopToolList = document.getElementById('shopToolList');
const shopEggList = document.getElementById('shopEggList');
const shopDecorList = document.getElementById('shopDecorList');
const shopSeedRestock = document.getElementById('shopSeedRestock');
const shopToolRestock = document.getElementById('shopToolRestock');
const shopEggRestock = document.getElementById('shopEggRestock');
const shopDecorRestock = document.getElementById('shopDecorRestock');
const formCard = document.querySelector('.form-card');
const shopsCard = document.getElementById('shopsCard');
const shopsColumn = document.getElementById('shopsColumn');
const alertsCard = document.getElementById('alertsCard');
const statusCard = document.getElementById('statusCard');
const petCard = document.getElementById('petCard');
const logsCard = document.getElementById('logsCard');
const checkUpdateBtn = document.getElementById('checkUpdateBtn');
const openUpdateBtn = document.getElementById('openUpdateBtn');
const openGameBtn = document.getElementById('openGameBtn');
const toggleDevBtn = document.getElementById('toggleDevBtn');
const openGameSelect = document.getElementById('openGameSelect');
const updateStatus = document.getElementById('updateStatus');
const appRoot = document.querySelector('.app');
const mainView = document.getElementById('mainView');
const devView = document.getElementById('devView');
const devBackBtn = document.getElementById('devBackBtn');
const tabs = document.getElementById('tabs');
const addTabBtn = document.getElementById('addTabBtn');
const stackColumn = document.getElementById('stackColumn');
const trafficList = document.getElementById('trafficList');
const connList = document.getElementById('connList');
const trafficSearchInput = document.getElementById('trafficSearchInput');
const connSearchInput = document.getElementById('connSearchInput');
const reconnectCountdown = document.getElementById('reconnectCountdown');
const reconnectInputs = document.querySelectorAll(
  '.reconnect-card input[type="checkbox"][data-group]',
);
const reconnectDelayInputs = document.querySelectorAll('[data-delay-group]');
const reconnectDelayValues = {
  superseded: document.getElementById('reconnectDelaySupersededValue'),
  other: document.getElementById('reconnectDelayOtherValue'),
};
const reconnectDetails = document.querySelector('.reconnect-details');
const reconnectBody = document.querySelector('.reconnect-body');

const storageKeys = {
  sessions: 'mgafk.sessions',
  activeSession: 'mgafk.activeSession',
  alerts: 'mgafk.alerts',
};

const PET_HUNGER_COSTS = {
  worm: 500,
  snail: 1000,
  bee: 1500,
  chicken: 3000,
  bunny: 750,
  dragonfly: 250,
  pig: 50000,
  cow: 25000,
  turkey: 500,
  squirrel: 15000,
  turtle: 100000,
  goat: 20000,
  snowfox: 14000,
  stoat: 10000,
  whitecaribou: 30000,
  caribou: 30000,
  butterfly: 25000,
  capybara: 150000,
  peacock: 100000,
};

const RECONNECT_DELAY_LIMITS = {
  superseded: { min: 10, max: 60 },
  other: { min: 0, max: 10 },
};

const DEFAULT_RECONNECT = {
  unknown: true,
  delays: {
    supersededMs: 30000,
    otherMs: 0,
  },
  codes: {
    4100: true,
    4200: true,
    4250: false,
    4300: false,
    4310: true,
    4400: true,
    4500: true,
    4700: true,
    4710: true,
    4800: true,
  },
};

const RECONNECT_GROUPS = {
  superseded: [4250, 4300],
  other: [4100, 4200, 4310, 4400, 4500, 4700, 4710, 4800],
};

const RECONNECT_DELAY_KEYS = {
  superseded: 'supersededMs',
  other: 'otherMs',
};

const DEFAULT_GAME_URL = 'https://magicgarden.gg';
const SHOP_LABELS = {
  seed: 'Seeds',
  tool: 'Tools',
  egg: 'Eggs',
  decor: 'Decors',
};
const RESTOCK_SECONDS = {
  seed: 300,
  tool: 600,
  egg: 900,
  decor: 3600,
};
const WEATHER_ALERTS = [
  { key: 'Clear Skies', label: 'Clear Skies' },
  { key: 'Rain', label: 'Rain' },
  { key: 'Snow', label: 'Snow' },
  { key: 'Amber Moon', label: 'Amber Moon' },
  { key: 'Dawn', label: 'Dawn' },
];
const WEATHER_ICON_LABELS = {
  'Clear Skies': ['Sunny', 'ClearSkies', 'WeatherSunny'],
  Rain: ['Rain', 'WeatherRain'],
  Snow: ['Snow', 'WeatherSnow', 'Frost'],
  'Amber Moon': ['AmberMoon', 'AmberMoonWeather', 'Amber'],
  Dawn: ['Dawn', 'WeatherDawn'],
};
const PET_HUNGER_ALERT_ITEM = 'hunger<5';
const PET_HUNGER_THRESHOLD = 5;
const isAlertShop = (value) =>
  value === 'weather' ||
  value === 'pet' ||
  Object.prototype.hasOwnProperty.call(SHOP_LABELS, value);
let lastSize = { width: 0, height: 0 };
let lastMainSize = null;
let reconnectState = JSON.parse(JSON.stringify(DEFAULT_RECONNECT));
let activeSessionId = '';
const sessions = [];
const logVirtualState = {
  items: [],
  itemHeight: 0,
  itemGap: 0,
  itemBaseHeight: 0,
  buffer: 6,
  renderFrame: null,
  lastStart: -1,
  lastEnd: -1,
};
const logSpacer = document.createElement('div');
const logItems = document.createElement('div');
const DEV_LOG_LIMIT = 300;

if (logList) {
  logSpacer.className = 'log-spacer';
  logItems.className = 'log-items';
  logList.append(logSpacer, logItems);
}

const clone = (value) => JSON.parse(JSON.stringify(value));

const DEFAULT_ALERT_STATE = {
  shop: 'seed',
  notifyMode: 'windows',
  selected: {},
  catalog: { seed: [], tool: [], egg: [], decor: [] },
  triggered: {},
};

const normalizeAlertCatalog = (catalog) => {
  const base = { seed: [], tool: [], egg: [], decor: [] };
  if (!catalog || typeof catalog !== 'object') return base;
  Object.keys(base).forEach((key) => {
    const items = Array.isArray(catalog[key]) ? catalog[key] : [];
    base[key] = items
      .map((item) => ({
        name: item?.name,
        stock: Number.isFinite(item?.stock) ? item.stock : Number(item?.stock) || 0,
      }))
      .filter((item) => item.name);
  });
  return base;
};

const normalizeAlertState = (value) => {
  const next = clone(DEFAULT_ALERT_STATE);
  if (!value || typeof value !== 'object') return next;
  next.shop = isAlertShop(value.shop) ? value.shop : next.shop;
  const mode = String(value.notifyMode || '').toLowerCase();
  next.notifyMode = mode === 'sound' ? 'sound' : 'windows';
  next.selected = value.selected && typeof value.selected === 'object' ? value.selected : {};
  next.catalog = normalizeAlertCatalog(value.catalog);
  next.triggered = value.triggered && typeof value.triggered === 'object' ? value.triggered : {};
  return next;
};

let alertState = normalizeAlertState(null);

const loadAlertState = () => {
  const raw = localStorage.getItem(storageKeys.alerts);
  if (!raw) return normalizeAlertState(null);
  try {
    return normalizeAlertState(JSON.parse(raw));
  } catch {
    return normalizeAlertState(null);
  }
};

const persistAlertState = () => {
  const payload = {
    shop: alertState.shop,
    notifyMode: alertState.notifyMode || 'windows',
    selected: alertState.selected || {},
    catalog: alertState.catalog || {},
  };
  localStorage.setItem(storageKeys.alerts, JSON.stringify(payload));
};

const updateAlertCatalog = (catalog) => {
  const nextCatalog = normalizeAlertCatalog(catalog);
  alertState.catalog = nextCatalog;
  persistAlertState();
};

alertState = loadAlertState();

const buildTrayPets = (session) => {
  if (!session || !Array.isArray(session.pets)) return [];
  return session.pets.map((pet) => {
    const label = pet.name || pet.species || `Pet ${Number(pet.index || 0) + 1}`;
    const limit = getHungerLimit(pet.species);
    let hungerPct = null;
    if (Number.isFinite(pet.hunger) && limit) {
      hungerPct = Math.min(100, Math.max(0, (pet.hunger / limit) * 100));
    }
    return { label, hungerPct };
  });
};

const syncTraySession = (session) => {
  if (!session || !window.api?.setTraySession) return;
  window.api.setTraySession({
    id: session.id,
    name: session.name,
    connected: Boolean(session.connected),
    room: session.room || '',
    roomId: session.roomId || '',
    gameUrl: session.gameUrl || '',
    pets: buildTrayPets(session),
  });
};

const syncAllTraySessions = () => {
  sessions.forEach((session) => syncTraySession(session));
  if (window.api?.setActiveSession) {
    window.api.setActiveSession({ sessionId: activeSessionId });
  }
};

const generateSessionId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeReconnect = (value) => {
  const next = clone(DEFAULT_RECONNECT);
  if (!value || typeof value !== 'object') return next;

  if (Number.isFinite(value.delayMs)) {
    next.delays.supersededMs = value.delayMs;
    next.delays.otherMs = value.delayMs;
  }

  if (value.delays && typeof value.delays === 'object') {
    for (const [key, delay] of Object.entries(value.delays)) {
      if (!Number.isFinite(delay)) continue;
      if (Object.prototype.hasOwnProperty.call(next.delays, key)) {
        next.delays[key] = delay;
        continue;
      }
      if (key === 'updateMs' && !Number.isFinite(value.delays.otherMs)) {
        next.delays.otherMs = delay;
      }
    }
  }

  if (typeof value.unknown === 'boolean') {
    next.unknown = value.unknown;
  }

  if (value.codes && typeof value.codes === 'object') {
    next.codes = { ...next.codes, ...value.codes };
  }

  return next;
};

const buildSessionName = (index) => `Account ${index}`;

const createSession = (seed = {}, index = 1) => {
  const fallbackName = buildSessionName(index);
  const name = String(seed.name || '').trim() || fallbackName;
  const autoName =
    typeof seed.autoName === 'boolean' ? seed.autoName : name === fallbackName;

  return {
    id: seed.id || generateSessionId(),
    name,
    autoName,
    cookie: String(seed.cookie || ''),
    room: String(seed.room || ''),
    gameUrl: seed.gameUrl || DEFAULT_GAME_URL,
    reconnect: normalizeReconnect(seed.reconnect),
    connected: false,
    busy: false,
    status: 'idle',
    error: '',
    reconnectCountdown: '',
    players: 0,
    uptime: '00:00:00',
    playerId: '-',
    playerName: '-',
    roomId: '-',
    weather: '-',
    pets: [],
    petHungerAlerts: {},
    petHungerInitialized: false,
    logs: [],
    logQuery: String(seed.logQuery || ''),
    trafficLogs: [],
    connLogs: [],
    trafficQuery: '',
    connQuery: '',
    alertCatalogSynced: false,
    restockTimers: { seed: null, tool: null, egg: null, decor: null },
    restockInitialized: false,
    weatherInitialized: false,
    shops: { seed: [], tool: [], egg: [], decor: [], restock: {} },
  };
};

const persistSessions = () => {
  const payload = sessions.map((session) => ({
    id: session.id,
    name: session.name,
    autoName: session.autoName !== false,
    cookie: session.cookie,
    room: session.room,
    gameUrl: session.gameUrl,
    reconnect: session.reconnect,
    logQuery: session.logQuery || '',
  }));
  localStorage.setItem(storageKeys.sessions, JSON.stringify(payload));
  localStorage.setItem(storageKeys.activeSession, activeSessionId);
  syncAllTraySessions();
};

const getActiveSession = () => sessions.find((session) => session.id === activeSessionId);
const getSessionById = (id) => sessions.find((session) => session.id === id);

const setError = (msg) => {
  const session = getActiveSession();
  if (session) session.error = msg ? String(msg) : '';
  errorText.textContent = msg ? String(msg) : '';
};

const setUpdateStatus = (msg) => {
  if (updateStatus) updateStatus.textContent = msg ? String(msg) : '';
};

const setTrayUpdateStatus = (msg) => {
  if (!window.api?.setTrayUpdateStatus) return;
  window.api.setTrayUpdateStatus({ text: msg ? String(msg) : '' });
};

const runUpdateCheck = async ({ showProgress = false } = {}) => {
  if (!window.api?.checkUpdate) return;
  if (showProgress && checkUpdateBtn) checkUpdateBtn.disabled = true;
  if (showProgress) setUpdateStatus('Checking...');
  if (showProgress) setTrayUpdateStatus('Checking...');
  if (openUpdateBtn) {
    openUpdateBtn.classList.add('hidden');
    openUpdateBtn.textContent = 'Download';
  }
  try {
    const result = await window.api.checkUpdate();
    if (!result || result.status === 'error') {
      if (showProgress) {
        const msg = result?.message || 'Update check failed.';
        setUpdateStatus(msg);
        setTrayUpdateStatus(msg);
      }
      return;
    }
    if (result.status === 'no-release') {
      setUpdateStatus('No releases yet.');
      setTrayUpdateStatus('No releases yet.');
      if (openUpdateBtn && result.url) {
        openUpdateBtn.dataset.url = result.url;
        openUpdateBtn.textContent = 'Open releases';
        openUpdateBtn.classList.remove('hidden');
      }
      return;
    }
    if (result.status === 'available') {
      const msg = `Update available (${result.latestVersion})`;
      setUpdateStatus(msg);
      setTrayUpdateStatus(msg);
      if (openUpdateBtn && result.url) {
        openUpdateBtn.dataset.url = result.url;
        openUpdateBtn.textContent = 'Download';
        openUpdateBtn.classList.remove('hidden');
      }
      return;
    }
    setUpdateStatus('Up to date');
    setTrayUpdateStatus('Up to date');
  } catch (err) {
    if (showProgress) {
      const msg = err && err.message ? err.message : 'Update check failed.';
      setUpdateStatus(msg);
      setTrayUpdateStatus(msg);
    }
  } finally {
    if (showProgress && checkUpdateBtn) checkUpdateBtn.disabled = false;
  }
};

const setBusy = (session, value) => {
  if (!session) return;
  session.busy = value;
  if (session === getActiveSession()) {
    toggleBtn.disabled = value;
  }
};

const setConnected = (session, value) => {
  if (!session) return;
  session.connected = value;
  if (session !== getActiveSession()) return;
  toggleBtn.textContent = value ? 'Disconnect' : 'Connect';
  toggleBtn.classList.toggle('secondary', value);
  toggleBtn.classList.toggle('primary', !value);
  cookieInput.disabled = value;
  if (roomInput) roomInput.disabled = value;
};

const setStatusChip = (state) => {
  statusChip.classList.remove('chip-idle', 'chip-online', 'chip-connecting', 'chip-error');
  if (state === 'connected') {
    statusChip.textContent = 'Online';
    statusChip.classList.add('chip-online');
    return;
  }
  if (state === 'connecting') {
    statusChip.textContent = 'Connecting...';
    statusChip.classList.add('chip-connecting');
    return;
  }
  if (state === 'error') {
    statusChip.textContent = 'Error';
    statusChip.classList.add('chip-error');
    return;
  }
  statusChip.textContent = 'Offline';
  statusChip.classList.add('chip-idle');
};

const renderPets = (pets) => {
  if (!petList) return;
  petList.innerHTML = '';
  const entries = Array.isArray(pets) ? pets : [];
  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'pet-empty';
    empty.textContent = 'No pets';
    petList.appendChild(empty);
    return;
  }
  entries.forEach((pet) => {
    const item = document.createElement('div');
    item.className = 'pet-item';

    const labelWrap = document.createElement('span');
    labelWrap.className = 'pet-label';

    const icon = document.createElement('img');
    icon.className = 'item-sprite sprite-placeholder';
    icon.alt = '';
    icon.loading = 'lazy';
    icon.decoding = 'async';

    const name = document.createElement('span');
    name.className = 'label';
    name.textContent = pet.name || pet.species || `Pet ${Number(pet.index || 0) + 1}`;

    labelWrap.appendChild(icon);
    labelWrap.appendChild(name);

    const hunger = document.createElement('span');
    hunger.className = 'pet-hunger';
    const limit = getHungerLimit(pet.species);
    if (Number.isFinite(pet.hunger) && limit) {
      const pct = Math.min(100, Math.max(0, (pet.hunger / limit) * 100));
      hunger.textContent = `${Math.round(pct)}%`;
    } else {
      hunger.textContent = '-';
    }

    item.appendChild(labelWrap);
    item.appendChild(hunger);
    petList.appendChild(item);

    const species = pet.species || '';
    if (window.spriteResolver?.getIcon && species) {
      const request = window.spriteResolver.getIcon({
        shop: 'pet',
        item: species,
        size: 16,
        mutation: pet.mutations,
      });
      if (request && typeof request.then === 'function') {
        request
          .then((url) => {
            if (!url) return;
            icon.src = url;
            icon.classList.remove('sprite-placeholder');
          })
          .catch(() => {});
      }
    }
  });
};

const renderLogs = (logs) => {
  const items = Array.isArray(logs) ? logs : [];
  logVirtualState.items = items;
  logVirtualState.lastStart = -1;
  logVirtualState.lastEnd = -1;
  scheduleLogRender();
};

const getAlertKey = (shop, item) => `${shop}|${item}`;
const PET_HUNGER_ALERT_KEY = getAlertKey('pet', PET_HUNGER_ALERT_ITEM);
let weatherIconKey = '';

const resolveWeatherKey = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  const match = WEATHER_ALERTS.find(
    (option) => option.key.toLowerCase() === text || option.label.toLowerCase() === text,
  );
  return match ? match.key : '';
};

const getWeatherCandidates = (value) => {
  const key = resolveWeatherKey(value) || String(value || '').trim();
  if (!key) return [];
  const candidates = WEATHER_ICON_LABELS[key] || [key];
  return candidates.filter(Boolean);
};

const resolveWeatherIconUrl = async (value) => {
  if (!window.spriteResolver?.getIcon) return null;
  const candidates = getWeatherCandidates(value);
  for (const candidate of candidates) {
    const url = await window.spriteResolver.getIcon({
      shop: 'ui',
      item: candidate,
      size: 16,
    });
    if (url) return url;
  }
  return null;
};

const updateWeatherIcon = async (value) => {
  if (!weatherIcon) return;
  const key = resolveWeatherKey(value) || String(value || '').trim();
  if (!key) {
    weatherIconKey = '';
    weatherIcon.removeAttribute('src');
    weatherIcon.classList.add('sprite-placeholder');
    return;
  }
  if (weatherIconKey === key) return;
  weatherIconKey = key;
  weatherIcon.removeAttribute('src');
  weatherIcon.classList.add('sprite-placeholder');
  const url = await resolveWeatherIconUrl(key);
  if (!url) return;
  weatherIcon.src = url;
  weatherIcon.classList.remove('sprite-placeholder');
};

const buildAlertRows = () => {
  const rows = [];
  const selectedShop = isAlertShop(alertState.shop) ? alertState.shop : 'seed';
  if (selectedShop === 'weather') {
    WEATHER_ALERTS.forEach((option) => {
      rows.push({ shopKey: 'weather', item: option.label, key: option.key, stock: 0 });
    });
    return rows;
  }
  if (selectedShop === 'pet') {
    rows.push({
      shopKey: 'pet',
      item: 'Pet hunger < 5%',
      key: PET_HUNGER_ALERT_ITEM,
      stock: 0,
    });
    return rows;
  }

  const items = Array.isArray(alertState.catalog?.[selectedShop])
    ? alertState.catalog[selectedShop]
    : [];
  items.forEach((entry) => {
    if (!entry?.name) return;
    const row = {
      shopKey: selectedShop,
      item: entry.name,
      key: entry.name,
      stock: entry.stock,
    };
    rows.push(row);
  });

  return rows;
};


const renderAlertTable = () => {
  if (!alertRows) return;
  alertRows.innerHTML = '';
  const rows = buildAlertRows();
  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'alerts-row';
    empty.innerHTML = '<span class="alerts-cell">No items</span><span></span>';
    alertRows.appendChild(empty);
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement('div');
    item.className = 'alerts-row';

    const itemCell = document.createElement('div');
    itemCell.className = 'alerts-item';

    if (row.shopKey !== 'pet') {
      const icon = document.createElement('img');
      icon.className = 'item-sprite sprite-placeholder';
      icon.alt = '';
      icon.loading = 'lazy';
      icon.decoding = 'async';
      itemCell.appendChild(icon);

      if (row.shopKey === 'weather') {
        resolveWeatherIconUrl(row.item)
          .then((url) => {
            if (!url) return;
            icon.src = url;
            icon.classList.remove('sprite-placeholder');
          })
          .catch(() => {});
      } else if (window.spriteResolver?.getIcon && row.item) {
        const request = window.spriteResolver.getIcon({
          shop: row.shopKey,
          item: row.item,
          size: 16,
        });
        if (request && typeof request.then === 'function') {
          request
            .then((url) => {
              if (!url) return;
              icon.src = url;
              icon.classList.remove('sprite-placeholder');
            })
            .catch(() => {});
        }
      }
    }

    const text = document.createElement('span');
    text.textContent = row.item;
    itemCell.appendChild(text);

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'alert-toggle';
    const key = getAlertKey(row.shopKey, row.key || row.item);
    toggle.checked = Boolean(alertState.selected?.[key]);
    toggle.addEventListener('change', () => {
      alertState.selected = alertState.selected || {};
      alertState.selected[key] = toggle.checked;
      persistAlertState();
      checkShopAlerts();
      if (key === PET_HUNGER_ALERT_KEY) {
        resetPetHungerState();
      }
    });

    item.appendChild(itemCell);
    item.appendChild(toggle);
    alertRows.appendChild(item);
  });
};

const ALERT_SOUND_URL = (() => {
  try {
    return new URL('assets/notif.mp3', window.location.href).toString();
  } catch {
    return 'assets/notif.mp3';
  }
})();

const PET_HUNGER_SOUND_URL = (() => {
  try {
    return new URL('assets/pethunger.mp3', window.location.href).toString();
  } catch {
    return 'assets/pethunger.mp3';
  }
})();

const playAlertSound = async (url = ALERT_SOUND_URL) => {
  if (!url) return;
  const audio = new Audio(url);
  audio.volume = 0.9;
  try {
    await audio.play();
  } catch {
    // Ignore blocked playback.
  }
};

const getNotifyMode = () =>
  alertState.notifyMode === 'sound' ? 'sound' : 'windows';

const buildNotificationBody = (title, body) => {
  const header = String(title || '').trim();
  const detail = String(body || '').trim();
  if (header && detail) return `${header}\n${detail}`;
  return header || detail || 'Notification';
};

const notifyAlert = async ({ title, body, sound } = {}) => {
  if (getNotifyMode() === 'sound') {
    const soundUrl = sound === 'petHunger' ? PET_HUNGER_SOUND_URL : ALERT_SOUND_URL;
    await playAlertSound(soundUrl);
    return;
  }
  if (!window.api?.notify) return;
  window.api.notify({ title: 'MG AFK', body: buildNotificationBody(title, body) });
};

const notifyShopRestock = (shopLabel, items) => {
  if (!Array.isArray(items) || items.length === 0) return;
  const title = `Shop restock: ${shopLabel}`;
  const body = items.map((item) => item.name).join(', ');
  notifyAlert({ title, body });
};

const notifyWeatherChange = (weather) => {
  const title = 'Weather update';
  const body = `Weather: ${weather}`;
  notifyAlert({ title, body });
};

const notifyPetHunger = (pets) => {
  if (!Array.isArray(pets) || pets.length === 0) return;
  const title = 'Pet hunger alert';
  const body = pets
    .map((pet) => `${pet.label} ${Math.round(pet.pct)}%`)
    .join(', ');
  notifyAlert({ title, body, sound: 'petHunger' });
};

const resetPetHungerState = () => {
  sessions.forEach((session) => {
    session.petHungerAlerts = {};
    session.petHungerInitialized = false;
  });
};

const checkPetHungerAlerts = (session) => {
  if (!session) return;
  const enabled = Boolean(alertState.selected?.[PET_HUNGER_ALERT_KEY]);
  if (!enabled) {
    session.petHungerAlerts = {};
    session.petHungerInitialized = false;
    return;
  }

  const pets = Array.isArray(session.pets) ? session.pets : [];
  if (!pets.length) {
    session.petHungerAlerts = {};
    session.petHungerInitialized = true;
    return;
  }

  const prev = session.petHungerAlerts || {};
  const next = {};
  const newlyLow = [];

  pets.forEach((pet) => {
    const pct = getPetHungerPct(pet);
    if (pct == null) return;
    const key = getPetKey(pet);
    const isLow = pct < PET_HUNGER_THRESHOLD;
    next[key] = isLow;
    if (session.petHungerInitialized && isLow && !prev[key]) {
      newlyLow.push({ label: getPetLabel(pet), pct });
    }
  });

  session.petHungerAlerts = next;
  if (!session.petHungerInitialized) {
    session.petHungerInitialized = true;
    return;
  }
  if (newlyLow.length) {
    notifyPetHunger(newlyLow);
  }
};

const shouldNotifyRestock = (shopKey, items) => {
  if (!items.length) return false;
  const alerts = alertState.selected || {};
  return items.some((item) => alerts[getAlertKey(shopKey, item.name)]);
};

const checkWeatherAlerts = (session, nextWeather) => {
  if (!session) return;
  const prevWeather = session.weather;
  const initialized = session.weatherInitialized;
  session.weatherInitialized = true;
  if (!initialized) return;
  if (!prevWeather || !nextWeather || prevWeather === nextWeather) return;
  const key = resolveWeatherKey(nextWeather);
  if (!key) return;
  const enabled = Boolean(alertState.selected?.[getAlertKey('weather', key)]);
  if (!enabled) return;
  notifyWeatherChange(nextWeather);
};

const checkShopRestocks = (session, payload) => {
  if (!session || !payload?.restock) return;
  const prev = session.restockTimers || {};
  const next = payload.restock || {};
  const initialized = session.restockInitialized;
  session.restockTimers = { ...next };
  session.restockInitialized = true;
  if (!initialized) return;
  const soundOnly = getNotifyMode() === 'sound';
  let shouldPlaySound = false;

  Object.entries(SHOP_LABELS).forEach(([shopKey, label]) => {
    const prevValue = prev?.[shopKey];
    const nextValue = next?.[shopKey];
    if (!Number.isFinite(prevValue) || !Number.isFinite(nextValue)) return;
    const jumped = nextValue > prevValue;
    if (!jumped) return;
    const duration = RESTOCK_SECONDS[shopKey];
    const nearFull = Number.isFinite(duration) ? duration - 2 : null;
    const items = Array.isArray(payload[shopKey]) ? payload[shopKey] : [];
    if (nearFull == null || nextValue < nearFull) return;
    if (!items.length) return;
    if (!shouldNotifyRestock(shopKey, items)) return;
    const selectedItems = items.filter(
      (item) => item?.name && alertState.selected?.[getAlertKey(shopKey, item.name)],
    );
    if (!selectedItems.length) return;
    if (soundOnly) {
      shouldPlaySound = true;
      return;
    }
    notifyShopRestock(label, selectedItems);
  });
  if (soundOnly && shouldPlaySound) {
    void playAlertSound();
  }
};

const checkShopAlerts = () => {
  const catalog = alertState.catalog || {};
  const triggered = alertState.triggered || {};
  Object.entries(SHOP_LABELS).forEach(([shopKey, label]) => {
    const items = Array.isArray(catalog[shopKey]) ? catalog[shopKey] : [];
    items.forEach((entry) => {
      if (!entry?.name) return;
      const key = getAlertKey(shopKey, entry.name);
      const enabled = Boolean(alertState.selected?.[key]);
      const available = Number(entry.stock) > 0;
      if (!enabled) {
        triggered[key] = false;
        return;
      }
      if (!available) {
        triggered[key] = false;
        return;
      }
      triggered[key] = true;
    });
  });
  alertState.triggered = triggered;
};

const getFilteredLogs = (session) => {
  if (!session) return [];
  const items = Array.isArray(session.logs) ? session.logs : [];
  const query = String(session.logQuery || '').trim().toLowerCase();
  if (!query) return items;
  return items.filter((entry) => {
    if (!entry) return false;
    const parts = [entry.action, entry.petName, entry.petSpecies].filter(Boolean);
    if (parts.length === 0) return false;
    return parts.join(' ').toLowerCase().includes(query);
  });
};

const renderShops = (payload) => {
  if (!payload || !window.shopsView) return;
  window.shopsView.renderShops(
    {
      seed: { list: shopSeedList, restock: shopSeedRestock },
      tool: { list: shopToolList, restock: shopToolRestock },
      egg: { list: shopEggList, restock: shopEggRestock },
      decor: { list: shopDecorList, restock: shopDecorRestock },
    },
    payload,
  );
};

const applyAlertStateToUI = () => {
  if (alertShopSelect) {
    const options = Array.from(alertShopSelect.options);
    const match = options.find((opt) => opt.value === alertState.shop);
    const nextValue = match ? alertState.shop : options[0]?.value || 'seed';
    alertShopSelect.value = nextValue;
    if (alertState.shop !== nextValue) {
      alertState.shop = nextValue;
      persistAlertState();
    }
  }
  if (alertNotifySelect) {
    const options = Array.from(alertNotifySelect.options);
    const match = options.find((opt) => opt.value === alertState.notifyMode);
    const nextValue = match ? alertState.notifyMode : options[0]?.value || 'windows';
    alertNotifySelect.value = nextValue;
    if (alertState.notifyMode !== nextValue) {
      alertState.notifyMode = nextValue;
      persistAlertState();
    }
  }
  renderAlertTable();
  checkShopAlerts();
};

const applySessionToUI = (session) => {
  if (!session) return;
  cookieInput.value = session.cookie || '';
  if (roomInput) roomInput.value = session.room || '';
  if (openGameSelect) {
    const options = Array.from(openGameSelect.options);
    const match = options.find((opt) => opt.value === session.gameUrl);
    const nextValue = match ? session.gameUrl : options[0]?.value || DEFAULT_GAME_URL;
    openGameSelect.value = nextValue;
    if (session.gameUrl !== nextValue) {
      session.gameUrl = nextValue;
      persistSessions();
    }
  }

  setConnected(session, Boolean(session.connected));
  toggleBtn.disabled = Boolean(session.busy);

  setStatusChip(session.status || 'idle');
  errorText.textContent = session.error || '';
  if (reconnectCountdown) reconnectCountdown.textContent = session.reconnectCountdown || '';

  playersValue.textContent = String(session.players || 0);
  uptimeValue.textContent = session.uptime || '00:00:00';
  playerIdValue.textContent = session.playerId || '-';
  if (playerNameValue) playerNameValue.textContent = session.playerName || '-';
  if (roomIdValue) roomIdValue.textContent = session.roomId || '-';
  if (weatherValue) weatherValue.textContent = session.weather || '-';
  void updateWeatherIcon(session.weather);

  renderPets(session.pets || []);
  if (logSearchInput) logSearchInput.value = session.logQuery || '';
  if (trafficSearchInput) trafficSearchInput.value = session.trafficQuery || '';
  if (connSearchInput) connSearchInput.value = session.connQuery || '';
  renderLogs(getFilteredLogs(session));
  renderTrafficLogs(session);
  renderConnLogs(session);
  renderShops(session.shops || { seed: [], tool: [], egg: [], decor: [], restock: {} });
  applyAlertStateToUI();

  if (!session.reconnect) session.reconnect = clone(DEFAULT_RECONNECT);
  reconnectState = session.reconnect;
  updateReconnectUI();
  syncLogHeight();
  scheduleResize();
};

const resetSessionStats = (session) => {
  if (!session) return;
  session.players = 0;
  session.uptime = '00:00:00';
  session.playerId = '-';
  session.playerName = '-';
  session.roomId = '-';
  session.weather = '-';
  session.pets = [];
  session.petHungerAlerts = {};
  session.petHungerInitialized = false;
  session.logs = [];
  session.alertCatalogSynced = false;
  session.restockTimers = { seed: null, tool: null, egg: null, decor: null };
  session.restockInitialized = false;
  session.weatherInitialized = false;
  session.shops = { seed: [], tool: [], egg: [], decor: [], restock: {} };
};

async function removeSession(id) {
  const index = sessions.findIndex((session) => session.id === id);
  if (index === -1) return;
  const [removed] = sessions.splice(index, 1);
  if (removed?.connected || removed?.busy) {
    await window.api.disconnect({ sessionId: removed.id });
  }
  if (window.api?.dispose) {
    await window.api.dispose({ sessionId: removed.id });
  }
  if (window.api?.setTraySession) {
    window.api.setTraySession({ id: removed.id, removed: true });
  }
  if (sessions.length === 0) {
    sessions.push(createSession({}, 1));
  }
  if (activeSessionId === id) {
    const next = sessions[Math.min(index, sessions.length - 1)];
    setActiveSession(next.id);
    return;
  }
  persistSessions();
  renderTabs();
}

const renderTabs = () => {
  if (!tabs) return;
  tabs.innerHTML = '';
  sessions.forEach((session) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `tab${session.id === activeSessionId ? ' active' : ''}`;
    tab.dataset.sessionId = session.id;

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = session.name;
    tab.appendChild(label);

    if (sessions.length > 1) {
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'tab-close';
      closeBtn.textContent = 'x';
      closeBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        await removeSession(session.id);
      });
      tab.appendChild(closeBtn);
    }

    tab.addEventListener('click', () => {
      if (label.isContentEditable) return;
      setActiveSession(session.id);
    });

    tabs.appendChild(tab);
  });
  if (addTabBtn) {
    tabs.appendChild(addTabBtn);
  }
};

const setActiveSession = (id) => {
  const target = sessions.find((session) => session.id === id) || sessions[0];
  if (!target) return;
  activeSessionId = target.id;
  persistSessions();
  applySessionToUI(target);
  renderTabs();
  if (window.api?.setActiveSession) {
    window.api.setActiveSession({ sessionId: activeSessionId });
  }
  syncTraySession(target);
};

const saveInputs = () => {
  const session = getActiveSession();
  if (!session) return;
  session.cookie = cookieInput.value;
  if (roomInput) session.room = roomInput.value;
  persistSessions();
};

const maybeMigrateLegacyAlerts = (parsed) => {
  if (localStorage.getItem(storageKeys.alerts)) return;
  if (!Array.isArray(parsed) || parsed.length === 0) return;
  const legacy = parsed.find(
    (entry) => entry?.shopAlerts || entry?.alertShop || entry?.alertsQuery,
  );
  if (!legacy) return;
  alertState = normalizeAlertState({
    shop: legacy.alertShop,
    query: legacy.alertsQuery,
    selected: legacy.shopAlerts,
    catalog: legacy.shopCatalog || alertState.catalog,
  });
  persistAlertState();
};

const loadSessions = () => {
  sessions.length = 0;
  const raw = localStorage.getItem(storageKeys.sessions);
  let parsed = [];
  if (raw) {
    try {
      parsed = JSON.parse(raw) || [];
    } catch {
      parsed = [];
    }
  }
  maybeMigrateLegacyAlerts(parsed);
  if (Array.isArray(parsed) && parsed.length) {
    parsed.forEach((session, index) => {
      sessions.push(createSession(session, index + 1));
    });
  } else {
    let legacyReconnect = null;
    const legacyRaw = localStorage.getItem('mgafk.reconnect');
    if (legacyRaw) {
      try {
        legacyReconnect = JSON.parse(legacyRaw);
      } catch {
        legacyReconnect = null;
      }
    }
    sessions.push(
      createSession(
        {
          cookie: localStorage.getItem('mgafk.cookie') || '',
          room: localStorage.getItem('mgafk.room') || '',
          gameUrl: localStorage.getItem('mgafk.gameUrl') || DEFAULT_GAME_URL,
          reconnect: legacyReconnect,
        },
        1,
      ),
    );
  }
  activeSessionId =
    localStorage.getItem(storageKeys.activeSession) || sessions[0]?.id || '';
  if (!sessions.find((session) => session.id === activeSessionId)) {
    activeSessionId = sessions[0]?.id || '';
  }
};

const updateReconnectUI = () => {
  reconnectInputs.forEach((input) => {
    const group = input.dataset.group;
    if (!group || !RECONNECT_GROUPS[group]) return;
    const codes = RECONNECT_GROUPS[group];
    const allOn = codes.every((code) => reconnectState.codes[code]);
    if (group === 'other') {
      input.checked = allOn && reconnectState.unknown;
    } else {
      input.checked = allOn;
    }
  });
  reconnectDelayInputs.forEach((input) => {
    const group = input.dataset.delayGroup;
    const key = RECONNECT_DELAY_KEYS[group];
    if (!key) return;
    const limits = RECONNECT_DELAY_LIMITS[group];
    const min = limits ? limits.min : 0;
    const max = limits ? limits.max : 60;
    const seconds = Math.max(
      min,
      Math.min(max, Math.round(reconnectState.delays[key] / 1000)),
    );
    reconnectState.delays[key] = Math.max(0, Math.round(seconds * 1000));
    input.value = String(seconds);
    const valueEl = reconnectDelayValues[group];
    if (valueEl) valueEl.textContent = `${seconds}s`;
  });
};

const buildReconnectConfig = () => ({
  delays: { ...reconnectState.delays },
  unknown: reconnectState.unknown,
  codes: { ...reconnectState.codes },
});

const setupReconnectAnimation = () => {
  if (!reconnectDetails || !reconnectBody) return;
  const summary = reconnectDetails.querySelector('summary');
  if (!summary) return;

  const closeWithAnimation = () => {
    const height = reconnectBody.scrollHeight;
    reconnectBody.style.maxHeight = `${height}px`;
    reconnectBody.style.opacity = '1';
    reconnectBody.style.transform = 'translateY(0)';
    requestAnimationFrame(() => {
      reconnectBody.style.maxHeight = '0px';
      reconnectBody.style.opacity = '0';
      reconnectBody.style.transform = 'translateY(-4px)';
    });
    const done = () => {
      reconnectDetails.removeAttribute('open');
      reconnectBody.removeEventListener('transitionend', done);
      scheduleResize();
    };
    reconnectBody.addEventListener('transitionend', done);
  };

  const openWithAnimation = () => {
    reconnectDetails.setAttribute('open', '');
    reconnectBody.style.maxHeight = '0px';
    reconnectBody.style.opacity = '0';
    reconnectBody.style.transform = 'translateY(-4px)';
    requestAnimationFrame(() => {
      const height = reconnectBody.scrollHeight;
      reconnectBody.style.maxHeight = `${height}px`;
      reconnectBody.style.opacity = '1';
      reconnectBody.style.transform = 'translateY(0)';
      scheduleResize();
    });
  };

  summary.addEventListener('click', (event) => {
    event.preventDefault();
    if (reconnectDetails.hasAttribute('open')) {
      closeWithAnimation();
    } else {
      openWithAnimation();
    }
  });
};

const getHungerLimit = (species) => {
  const key = String(species || '')
    .toLowerCase()
    .replace(/\s+/g, '');
  return PET_HUNGER_COSTS[key] || null;
};

const copyTextToClipboard = async (text) => {
  if (!text) return false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall back to execCommand
    }
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', 'true');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(el);
  return ok;
};

const formatLogTime = (ts) =>
  new Date(ts).toLocaleTimeString('fr-FR', { hour12: false });

const truncateText = (text, max = 180) => {
  const value = String(text || '');
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
};

const parseTrafficMessage = (text) => {
  const raw = String(text || '');
  const trimmed = raw.trim();
  if (!trimmed) return { parsed: null, type: '' };
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return { parsed: null, type: '' };
  }
  try {
    const parsed = JSON.parse(trimmed);
    const type =
      parsed && typeof parsed === 'object' && typeof parsed.type === 'string'
        ? parsed.type
        : '';
    return { parsed, type };
  } catch {
    return { parsed: null, type: '' };
  }
};

const buildTrafficEntry = (payload) => {
  const ts = Number(payload?.ts) || Date.now();
  const direction = payload?.direction === 'out' ? 'out' : 'in';
  const text = String(payload?.text || '');
  const { parsed, type } = parseTrafficMessage(text);
  const copyText = parsed ? JSON.stringify(parsed, null, 2) : text;
  const preview = truncateText(parsed ? JSON.stringify(parsed) : text);
  const search = `${direction} ${type} ${text}`.toLowerCase();
  return { ts, direction, text, type, preview, copyText, search };
};

const buildConnEntry = (payload) => {
  const ts = Number(payload?.ts) || Date.now();
  const level = String(payload?.level || 'info');
  const message = String(payload?.message || '');
  const detail = String(payload?.detail || '');
  const text = [message, detail].filter(Boolean).join(' | ');
  const preview = truncateText(text);
  const copyText = text;
  const search = `${level} ${text}`.toLowerCase();
  const lc = message.toLowerCase();
  let badge = 'INFO';
  let badgeClass = 'info';
  if (lc.includes('connect ok')) {
    badge = 'CONNECTED';
    badgeClass = 'success';
  } else if (lc.includes('connect request')) {
    badge = 'CONNECT';
    badgeClass = 'info';
  } else if (lc.includes('connect failed')) {
    badge = 'FAILED';
    badgeClass = 'error';
  } else if (lc.includes('ws disconnected')) {
    badge = 'DISCONNECTED';
    badgeClass = 'warn';
  } else if (lc.includes('ws closed')) {
    badge = 'DISCONNECTED';
    badgeClass = 'warn';
  } else if (lc.includes('ws error')) {
    badge = 'ERROR';
    badgeClass = 'error';
  } else if (lc.includes('ws status')) {
    badge = 'STATUS';
    badgeClass = 'info';
  } else if (lc.includes('game action')) {
    badge = 'ACTION';
    badgeClass = 'info';
  } else if (level.toLowerCase() === 'error') {
    badge = 'ERROR';
    badgeClass = 'error';
  }
  const codeMatch = detail.match(/\b(1\d{3}|2\d{3}|3\d{3}|4\d{3}|5\d{3})\b/);
  const code = codeMatch ? codeMatch[1] : '';
  if (code === '4250' || code === '4300') {
    badge = 'SUPERSEDED';
    badgeClass = 'warn';
  }
  return {
    ts,
    level,
    message,
    detail,
    preview,
    copyText,
    search,
    badge,
    badgeClass,
    code,
  };
};

const filterDevLogs = (logs, query) => {
  const term = String(query || '').trim().toLowerCase();
  if (!term) return logs;
  return logs.filter((entry) => entry.search.includes(term));
};

const renderTrafficLogs = (session) => {
  if (!trafficList) return;
  trafficList.innerHTML = '';
  const logs = filterDevLogs(session?.trafficLogs || [], session?.trafficQuery);
  if (!logs.length) {
    const empty = document.createElement('div');
    empty.className = 'dev-row';
    empty.textContent = 'No traffic yet';
    trafficList.appendChild(empty);
    return;
  }
  logs.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'dev-row';

    const left = document.createElement('div');
    left.className = 'dev-left';
    const meta = document.createElement('div');
    meta.className = 'dev-meta';

    const dir = document.createElement('span');
    dir.className = `dev-dir ${entry.direction}`;
    dir.textContent = entry.direction === 'out' ? 'OUT' : 'IN';

    const time = document.createElement('span');
    time.textContent = formatLogTime(entry.ts);

    meta.appendChild(dir);
    meta.appendChild(time);

    if (entry.type) {
      const type = document.createElement('span');
      type.textContent = entry.type;
      meta.appendChild(type);
    }

    const text = document.createElement('div');
    text.className = 'dev-text';
    text.textContent = entry.preview;

    left.appendChild(meta);
    left.appendChild(text);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'dev-copy';
    copyBtn.textContent = entry.type ? 'Copy JSON' : 'Copy';
    copyBtn.addEventListener('click', async () => {
      await copyTextToClipboard(entry.copyText);
    });

    row.appendChild(left);
    row.appendChild(copyBtn);
    trafficList.appendChild(row);
  });
};

const renderConnLogs = (session) => {
  if (!connList) return;
  connList.innerHTML = '';
  const logs = filterDevLogs(session?.connLogs || [], session?.connQuery);
  if (!logs.length) {
    const empty = document.createElement('div');
    empty.className = 'dev-row';
    empty.textContent = 'No connection logs yet';
    connList.appendChild(empty);
    return;
  }
  logs.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'dev-row';

    const left = document.createElement('div');
    left.className = 'dev-left';
    const meta = document.createElement('div');
    meta.className = 'dev-meta';

    const level = document.createElement('span');
    level.className = `dev-dir ${entry.badgeClass}`;
    level.textContent = entry.badge;

    const time = document.createElement('span');
    time.textContent = formatLogTime(entry.ts);

    meta.appendChild(level);
    meta.appendChild(time);
    if (entry.code) {
      const code = document.createElement('span');
      code.textContent = `Code ${entry.code}`;
      meta.appendChild(code);
    }

    const title = document.createElement('div');
    title.className = 'dev-text';
    title.textContent = entry.message || entry.preview;

    const detail = document.createElement('div');
    detail.className = 'dev-text muted';
    detail.textContent = entry.detail || '';

    left.appendChild(meta);
    left.appendChild(title);
    if (entry.detail) left.appendChild(detail);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'dev-copy';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      await copyTextToClipboard(entry.copyText);
    });

    row.appendChild(left);
    row.appendChild(copyBtn);
    connList.appendChild(row);
  });
};

const setDevView = (show) => {
  if (!mainView || !devView) return;
  const next = Boolean(show);
  if (
    next &&
    !mainView.classList.contains('hidden') &&
    lastSize.width &&
    lastSize.height
  ) {
    lastMainSize = { ...lastSize };
  }
  if (next && !lastMainSize && appRoot) {
    const rect = appRoot.getBoundingClientRect();
    if (rect.width && rect.height) {
      lastMainSize = {
        width: Math.ceil(rect.width + 8),
        height: Math.ceil(rect.height + 8),
      };
    }
  }
  if (next && lastMainSize && appRoot) {
    const maxWidth = Math.max(0, Math.round(lastMainSize.width - 8));
    const maxHeight = Math.max(0, Math.round(lastMainSize.height - 8));
    appRoot.style.maxWidth = `${maxWidth}px`;
    appRoot.style.maxHeight = `${maxHeight}px`;
  }
  if (!next && appRoot) {
    appRoot.style.maxWidth = '';
    appRoot.style.maxHeight = '';
  }
  if (!next && lastMainSize && window.api?.resizeTo) {
    window.api.resizeTo({ ...lastMainSize });
  }
  mainView.classList.toggle('hidden', next);
  devView.classList.toggle('hidden', !next);
  const session = getActiveSession();
  if (next && session) {
    renderTrafficLogs(session);
    renderConnLogs(session);
  }
  scheduleResize();
};

const getPetLabel = (pet) =>
  pet?.name || pet?.species || `Pet ${Number(pet?.index || 0) + 1}`;

const getPetKey = (pet) => {
  const id = String(pet?.id || '').trim();
  if (id) return `id:${id}`;
  const name = String(pet?.name || '').trim();
  const species = String(pet?.species || '').trim();
  const index = Number.isFinite(pet?.index) ? pet.index : '';
  return `pet:${name}|${species}|${index}`;
};

const getPetHungerPct = (pet) => {
  const limit = getHungerLimit(pet?.species);
  if (!Number.isFinite(pet?.hunger) || !limit) return null;
  return Math.min(100, Math.max(0, (pet.hunger / limit) * 100));
};

const createLogElement = (payload) => {
  const item = document.createElement('div');
  item.className = 'log-item';

  const time = document.createElement('div');
  time.className = 'log-time';
  time.textContent = payload.when || '';

  const row = document.createElement('div');
  row.className = 'log-row';

  const message = document.createElement('div');
  message.className = 'log-message';

  const petLabel = payload.petName || payload.petSpecies || '';
  const pet = petLabel ? ` - ${petLabel}` : '';

  const icon = document.createElement('img');
  icon.className = 'item-sprite sprite-placeholder log-sprite';
  icon.alt = '';
  icon.loading = 'lazy';
  icon.decoding = 'async';

  const text = document.createElement('span');
  text.textContent = `${payload.action || 'Ability'}${pet}`;

  message.appendChild(icon);
  message.appendChild(text);
  row.appendChild(message);

  item.appendChild(time);
  item.appendChild(row);

  const species = payload.petSpecies || payload.petName || '';
  if (window.spriteResolver?.getIcon && species) {
    const request = window.spriteResolver.getIcon({
      shop: 'pet',
      item: species,
      size: 16,
      mutation: payload.petMutations,
    });
    if (request && typeof request.then === 'function') {
      request
        .then((url) => {
          if (!url) return;
          icon.src = url;
          icon.classList.remove('sprite-placeholder');
        })
        .catch(() => {});
    }
  }

  return item;
};

const getLogItemHeight = (sample) => {
  if (logVirtualState.itemHeight) return logVirtualState.itemHeight;
  let fixedHeight = 0;
  let gap = 0;
  if (logList) {
    const styles = window.getComputedStyle(logList);
    const heightVar = styles.getPropertyValue('--log-item-height');
    fixedHeight = Number.parseFloat(heightVar) || 0;
    const gapVar = styles.getPropertyValue('--log-gap');
    gap = Number.parseFloat(gapVar);
    if (!Number.isFinite(gap)) {
      gap = Number.parseFloat(styles.rowGap || styles.gap || '0') || 0;
    }
  }
  if (fixedHeight > 0) {
    logVirtualState.itemGap = Number.isFinite(gap) ? gap : 0;
    logVirtualState.itemBaseHeight = fixedHeight;
    logVirtualState.itemHeight = fixedHeight + logVirtualState.itemGap;
    return logVirtualState.itemHeight;
  }
  if (!logItems) return 40;
  const payload = sample || { action: 'Ability', when: '' };
  const item = createLogElement(payload);
  logItems.appendChild(item);
  const height = item.getBoundingClientRect().height;
  const styles = window.getComputedStyle(logItems);
  const gapVar = styles.getPropertyValue('--log-gap');
  gap = Number.parseFloat(gapVar);
  if (!Number.isFinite(gap)) {
    gap = Number.parseFloat(styles.rowGap || styles.gap || '0') || 0;
  }
  logItems.removeChild(item);
  logVirtualState.itemGap = Number.isFinite(gap) ? gap : 0;
  logVirtualState.itemBaseHeight = height || 40;
  logVirtualState.itemHeight = logVirtualState.itemBaseHeight + logVirtualState.itemGap;
  return logVirtualState.itemHeight;
};

const renderVirtualLogs = () => {
  if (!logList || !logItems) return;
  const items = logVirtualState.items;
  const total = items.length;
  if (total === 0) {
    logSpacer.style.height = '0px';
    logItems.style.transform = 'translateY(0)';
    logItems.replaceChildren();
    logVirtualState.lastStart = 0;
    logVirtualState.lastEnd = 0;
    return;
  }

  const itemHeight = getLogItemHeight(items[0]);
  const viewportHeight = logList.clientHeight || 0;
  const buffer = logVirtualState.buffer;
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / itemHeight));
  const scrollTop = logList.scrollTop || 0;
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  const end = Math.min(total, start + visibleCount + buffer * 2);

  if (start === logVirtualState.lastStart && end === logVirtualState.lastEnd) {
    return;
  }

  logVirtualState.lastStart = start;
  logVirtualState.lastEnd = end;
  const gap = logVirtualState.itemGap || 0;
  const totalHeight = Math.max(0, total * itemHeight - gap);
  logSpacer.style.height = `${totalHeight}px`;
  logItems.style.transform = `translateY(${start * itemHeight}px)`;

  const fragment = document.createDocumentFragment();
  for (let i = start; i < end; i += 1) {
    fragment.appendChild(createLogElement(items[i]));
  }
  logItems.replaceChildren(fragment);
};

const scheduleLogRender = () => {
  if (logVirtualState.renderFrame) return;
  logVirtualState.renderFrame = window.requestAnimationFrame(() => {
    logVirtualState.renderFrame = null;
    renderVirtualLogs();
  });
};

const requestResize = () => {
  if (!appRoot || !window.api?.resizeTo) return;
  const rect = appRoot.getBoundingClientRect();
  const width = Math.ceil(rect.width + 8);
  const height = Math.ceil(rect.height + 8);
  if (
    mainView &&
    !mainView.classList.contains('hidden') &&
    window.matchMedia('(min-width: 861px)').matches
  ) {
    lastMainSize = { width, height };
  }
  if (Math.abs(width - lastSize.width) < 2 && Math.abs(height - lastSize.height) < 2) {
    return;
  }
  lastSize = { width, height };
  window.api.resizeTo({ width, height });
};

const scheduleResize = (() => {
  let frame = null;
  return () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      syncLogHeight();
      scheduleLogRender();
      requestResize();
    });
  };
})();

const syncLogHeight = () => {
  if (!formCard || !shopsColumn || !statusCard || !stackColumn) return;
  if (logsCard?.style.height) logsCard.style.height = '';
  if (!window.matchMedia('(min-width: 861px)').matches) {
    if (shopsColumn.style.height) shopsColumn.style.height = '';
    if (stackColumn.style.height) stackColumn.style.height = '';
    return;
  }
  const formRect = formCard.getBoundingClientRect();

  const statusRect = statusCard.getBoundingClientRect();
  const span = statusRect.bottom - formRect.top;
  if (span > 0) {
    const next = `${Math.ceil(span)}px`;
    if (shopsColumn.style.height !== next) {
      shopsColumn.style.height = next;
    }
    if (stackColumn.style.height !== next) {
      stackColumn.style.height = next;
    }
  }
};

const toggleSessionConnection = async (sessionId) => {
  const session = sessionId ? getSessionById(sessionId) : getActiveSession();
  if (!session || session.busy) return;
  if (sessionId && session.id !== activeSessionId) {
    setActiveSession(session.id);
  }
  toggleBtn.click();
};

loadSessions();
syncAllTraySessions();
setActiveSession(activeSessionId);
window.spriteResolver?.preload?.();
setupReconnectAnimation();
cookieInput.addEventListener('input', saveInputs);
roomInput?.addEventListener('input', saveInputs);
logSearchInput?.addEventListener('input', () => {
  const session = getActiveSession();
  if (!session) return;
  session.logQuery = logSearchInput.value;
  persistSessions();
  renderLogs(getFilteredLogs(session));
});
trafficSearchInput?.addEventListener('input', () => {
  const session = getActiveSession();
  if (!session) return;
  session.trafficQuery = trafficSearchInput.value;
  renderTrafficLogs(session);
});
connSearchInput?.addEventListener('input', () => {
  const session = getActiveSession();
  if (!session) return;
  session.connQuery = connSearchInput.value;
  renderConnLogs(session);
});
toggleDevBtn?.addEventListener('click', () => {
  setDevView(true);
});
devBackBtn?.addEventListener('click', () => {
  setDevView(false);
});
alertShopSelect?.addEventListener('change', () => {
  alertState.shop = alertShopSelect.value;
  persistAlertState();
  renderAlertTable();
  checkShopAlerts();
});
alertNotifySelect?.addEventListener('change', () => {
  alertState.notifyMode = alertNotifySelect.value;
  persistAlertState();
});
logList?.addEventListener('scroll', () => scheduleLogRender());
openGameSelect?.addEventListener('change', () => {
  const session = getActiveSession();
  if (!session) return;
  session.gameUrl = openGameSelect.value;
  persistSessions();
});
addTabBtn?.addEventListener('click', () => {
  const nextIndex = sessions.length + 1;
  const session = createSession({}, nextIndex);
  sessions.push(session);
  persistSessions();
  setActiveSession(session.id);
});
reconnectDelayInputs.forEach((input) => {
  input.addEventListener('input', () => {
    const group = input.dataset.delayGroup;
    const key = RECONNECT_DELAY_KEYS[group];
    if (!key) return;
    const seconds = Number(input.value || 0);
    const limits = RECONNECT_DELAY_LIMITS[group];
    const min = limits ? limits.min : 0;
    const max = limits ? limits.max : 60;
    const safe = Math.max(min, Math.min(max, Math.round(seconds)));
    reconnectState.delays[key] = Math.max(0, Math.round(safe * 1000));
    const valueEl = reconnectDelayValues[group];
    if (valueEl) valueEl.textContent = `${safe}s`;
    persistSessions();
  });
});
reconnectInputs.forEach((input) => {
  input.addEventListener('change', () => {
    const group = input.dataset.group;
    if (!group || !RECONNECT_GROUPS[group]) return;
    const checked = Boolean(input.checked);
    const codes = RECONNECT_GROUPS[group];
    for (const code of codes) {
      reconnectState.codes[code] = checked;
    }
    if (group === 'other') {
      reconnectState.unknown = checked;
    }
    persistSessions();
  });
});

checkUpdateBtn?.addEventListener('click', async () => {
  await runUpdateCheck({ showProgress: true });
});

openUpdateBtn?.addEventListener('click', async () => {
  const url = openUpdateBtn.dataset.url;
  if (!url || !window.api?.openExternal) return;
  await window.api.openExternal(url);
});

openGameBtn?.addEventListener('click', async () => {
  if (!window.api?.openExternal) return;
  const baseUrl = openGameSelect?.value || 'https://magicgarden.gg';
  const session = getActiveSession();
  const roomCode = session?.roomId || session?.room || '';
  const safeBase = baseUrl.replace(/\/+$/, '');
  const url = roomCode ? `${safeBase}/r/${roomCode}` : safeBase;
  await window.api.openExternal(url);
});

toggleBtn.addEventListener('click', async () => {
  const session = getActiveSession();
  if (!session || session.busy) return;
  setError('');

  if (session.connected) {
    setBusy(session, true);
    await window.api.disconnect({ sessionId: session.id });
    setBusy(session, false);
    return;
  }

  session.cookie = cookieInput.value.trim();
  session.room = roomInput ? roomInput.value.trim() : '';
  persistSessions();

  if (!session.cookie) {
    setError('Cookie is required.');
    return;
  }

  resetSessionStats(session);
  session.status = 'connecting';
  session.connected = false;
  session.error = '';
  session.reconnectCountdown = '';
  session.logs = [];
  setBusy(session, true);
  applySessionToUI(session);
  const result = await window.api.connect({
    sessionId: session.id,
    cookie: session.cookie,
    room: session.room || undefined,
    reconnect: buildReconnectConfig(),
  });
  setBusy(session, false);
  if (result && result.playerId) {
    session.playerId = result.playerId;
    if (session === getActiveSession()) playerIdValue.textContent = result.playerId;
  }
  if (result && result.error) setError(result.error);
});

window.api.onTrayToggle?.((payload) => {
  toggleSessionConnection(payload?.sessionId);
});

window.api.onTraySelectSession?.((payload) => {
  if (!payload?.sessionId) return;
  setActiveSession(payload.sessionId);
});

window.api.onTrayCheckUpdate?.(() => {
  runUpdateCheck({ showProgress: true });
});

const pushSessionLog = (session, payload) => {
  if (!session) return;
  session.logs.unshift(payload);
  while (session.logs.length > 200) {
    session.logs.pop();
  }
  if (session === getActiveSession()) {
    renderLogs(getFilteredLogs(session));
  }
};

const pushTrafficLog = (session, payload) => {
  if (!session) return;
  const entry = buildTrafficEntry(payload);
  session.trafficLogs.unshift(entry);
  while (session.trafficLogs.length > DEV_LOG_LIMIT) {
    session.trafficLogs.pop();
  }
  if (session === getActiveSession()) {
    renderTrafficLogs(session);
  }
};

const pushConnLog = (session, payload) => {
  if (!session) return;
  const entry = buildConnEntry(payload);
  session.connLogs.unshift(entry);
  while (session.connLogs.length > DEV_LOG_LIMIT) {
    session.connLogs.pop();
  }
  if (session === getActiveSession()) {
    renderConnLogs(session);
  }
};

window.api.onStatus((payload) => {
  if (!payload || !payload.state) return;
  const session = getSessionById(payload.sessionId);
  if (!session) return;

  if (payload.state === 'connected') {
    session.connected = true;
    session.status = 'connected';
    session.error = '';
    session.reconnectCountdown = '';
    if (payload.playerId) session.playerId = payload.playerId;
    if (payload.room) session.roomId = payload.room;
    syncTraySession(session);
    if (session === getActiveSession()) {
      setConnected(session, true);
      setStatusChip('connected');
      errorText.textContent = '';
      if (reconnectCountdown) reconnectCountdown.textContent = '';
      if (payload.playerId) playerIdValue.textContent = payload.playerId;
      if (payload.room && roomIdValue) roomIdValue.textContent = payload.room;
    }
    return;
  }

  if (payload.state === 'connecting') {
    session.connected = false;
    session.status = 'connecting';
    session.error = '';
    session.reconnectCountdown = '';
    session.alertCatalogSynced = false;
    if (session === getActiveSession()) {
      weatherIconKey = '';
    }
    syncTraySession(session);
    if (session === getActiveSession()) {
      setConnected(session, false);
      setStatusChip('connecting');
      errorText.textContent = '';
      if (reconnectCountdown) reconnectCountdown.textContent = '';
    }
    return;
  }

  if (payload.state === 'reconnecting') {
    session.connected = false;
    session.status = 'connecting';
    const remaining = Math.max(0, Math.ceil((payload.retryInMs || 0) / 1000));
    const attempt = payload.retry && payload.maxRetries
      ? ` (${payload.retry}/${payload.maxRetries})`
      : '';
    session.reconnectCountdown =
      remaining > 0 ? `Reconnect in ${remaining}s${attempt}` : `Reconnecting...${attempt}`;
    session.alertCatalogSynced = false;
    syncTraySession(session);
    if (session === getActiveSession()) {
      setConnected(session, false);
      setStatusChip('connecting');
      if (reconnectCountdown) reconnectCountdown.textContent = session.reconnectCountdown;
    }
    return;
  }

  if (payload.state === 'error') {
    session.connected = false;
    session.status = 'error';
    session.error = payload.message || 'Connection error.';
    session.reconnectCountdown = '';
    resetSessionStats(session);
    syncTraySession(session);
    if (session === getActiveSession()) {
      applySessionToUI(session);
    }
    return;
  }

  if (payload.state === 'disconnected') {
    session.connected = false;
    session.status = 'idle';
    session.error = '';
    session.reconnectCountdown = '';
    resetSessionStats(session);
    syncTraySession(session);
    if (session === getActiveSession()) {
      applySessionToUI(session);
    }
  }
});

window.api.onDebug?.((payload) => {
  if (!payload) return;
  const session = getSessionById(payload.sessionId);
  if (!session) return;
  pushConnLog(session, payload);
});

window.api.onPlayers((payload) => {
  if (!payload || typeof payload.count !== 'number') return;
  const session = getSessionById(payload.sessionId);
  if (!session) return;
  session.players = payload.count;
  if (session === getActiveSession()) {
    playersValue.textContent = String(payload.count);
  }
});

window.api.onUptime((payload) => {
  if (!payload || !payload.text) return;
  const session = getSessionById(payload.sessionId);
  if (!session) return;
  session.uptime = payload.text;
  if (session === getActiveSession()) {
    uptimeValue.textContent = payload.text;
  }
});

window.api.onAbilityLog((payload) => {
  if (!payload) return;
  const session = getSessionById(payload.sessionId);
  if (!session) return;
  pushSessionLog(session, payload);
});

window.api.onTraffic?.((payload) => {
  if (!payload) return;
  const session = getSessionById(payload.sessionId);
  if (!session) return;
  pushTrafficLog(session, payload);
});

window.api.onLiveStatus((payload) => {
  if (!payload) return;
  const session = getSessionById(payload.sessionId);
  if (!session) return;
  const nextWeather = payload.weather || '-';
  checkWeatherAlerts(session, nextWeather);
  session.playerName = payload.playerName || '-';
  session.roomId = payload.roomId || '-';
  session.weather = nextWeather;
  if (payload.playerId) session.playerId = payload.playerId;
  session.pets = Array.isArray(payload.pets) ? payload.pets : [];
  checkPetHungerAlerts(session);
  if (payload.playerName && session.autoName) {
    session.name = payload.playerName;
    persistSessions();
    renderTabs();
  }
  syncTraySession(session);
  if (session === getActiveSession()) {
    if (playerNameValue) playerNameValue.textContent = session.playerName;
    if (roomIdValue) roomIdValue.textContent = session.roomId;
    if (weatherValue) weatherValue.textContent = session.weather;
    void updateWeatherIcon(session.weather);
    if (playerIdValue) playerIdValue.textContent = session.playerId || '-';
    renderPets(session.pets);
    syncLogHeight();
  }
});

window.api.onShops?.((payload) => {
  if (!payload) return;
  const session = getSessionById(payload.sessionId);
  if (!session) return;
  checkShopRestocks(session, payload);
  session.shops = payload;
  if (payload.catalog && typeof payload.catalog === 'object' && !session.alertCatalogSynced) {
    updateAlertCatalog(payload.catalog);
    session.alertCatalogSynced = true;
    renderAlertTable();
  }
  checkShopAlerts();
  if (session === getActiveSession()) {
    renderShops(payload);
  }
});

syncLogHeight();
scheduleResize();
window.addEventListener('load', () => runUpdateCheck({ showProgress: false }));

if (appRoot && 'ResizeObserver' in window) {
  const observer = new ResizeObserver(() => scheduleResize());
  observer.observe(appRoot);
}

window.addEventListener('load', () => scheduleResize());

