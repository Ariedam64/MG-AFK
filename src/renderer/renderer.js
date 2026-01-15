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
const petList = document.getElementById('petList');
const logList = document.getElementById('logList');
const logSearchInput = document.getElementById('logSearchInput');
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
const statusCard = document.getElementById('statusCard');
const petCard = document.getElementById('petCard');
const logsCard = document.getElementById('logsCard');
const checkUpdateBtn = document.getElementById('checkUpdateBtn');
const openUpdateBtn = document.getElementById('openUpdateBtn');
const openGameBtn = document.getElementById('openGameBtn');
const openGameSelect = document.getElementById('openGameSelect');
const updateStatus = document.getElementById('updateStatus');
const appRoot = document.querySelector('.app');
const tabs = document.getElementById('tabs');
const addTabBtn = document.getElementById('addTabBtn');
const stackColumn = document.getElementById('stackColumn');
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
let lastSize = { width: 0, height: 0 };
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

if (logList) {
  logSpacer.className = 'log-spacer';
  logItems.className = 'log-items';
  logList.append(logSpacer, logItems);
}

const clone = (value) => JSON.parse(JSON.stringify(value));

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
    pets: [],
    logs: [],
    logQuery: String(seed.logQuery || ''),
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

const runUpdateCheck = async ({ showProgress = false } = {}) => {
  if (!window.api?.checkUpdate) return;
  if (showProgress && checkUpdateBtn) checkUpdateBtn.disabled = true;
  if (showProgress) setUpdateStatus('Checking...');
  if (openUpdateBtn) {
    openUpdateBtn.classList.add('hidden');
    openUpdateBtn.textContent = 'Download';
  }
  try {
    const result = await window.api.checkUpdate();
    if (!result || result.status === 'error') {
      if (showProgress) {
        setUpdateStatus(result?.message || 'Update check failed.');
      }
      return;
    }
    if (result.status === 'no-release') {
      setUpdateStatus('No releases yet.');
      if (openUpdateBtn && result.url) {
        openUpdateBtn.dataset.url = result.url;
        openUpdateBtn.textContent = 'Open releases';
        openUpdateBtn.classList.remove('hidden');
      }
      return;
    }
    if (result.status === 'available') {
      setUpdateStatus(`Update available (${result.latestVersion})`);
      if (openUpdateBtn && result.url) {
        openUpdateBtn.dataset.url = result.url;
        openUpdateBtn.textContent = 'Download';
        openUpdateBtn.classList.remove('hidden');
      }
      return;
    }
    setUpdateStatus('Up to date');
  } catch (err) {
    if (showProgress) {
      setUpdateStatus(err && err.message ? err.message : 'Update check failed.');
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

    const name = document.createElement('span');
    name.className = 'label';
    name.textContent = pet.name || pet.species || `Pet ${Number(pet.index || 0) + 1}`;

    const hunger = document.createElement('span');
    hunger.className = 'pet-hunger';
    const limit = getHungerLimit(pet.species);
    if (Number.isFinite(pet.hunger) && limit) {
      const pct = Math.min(100, Math.max(0, (pet.hunger / limit) * 100));
      hunger.textContent = `${Math.round(pct)}%`;
    } else {
      hunger.textContent = '-';
    }

    item.appendChild(name);
    item.appendChild(hunger);
    petList.appendChild(item);
  });
};

const renderLogs = (logs) => {
  const items = Array.isArray(logs) ? logs : [];
  logVirtualState.items = items;
  logVirtualState.lastStart = -1;
  logVirtualState.lastEnd = -1;
  scheduleLogRender();
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

  renderPets(session.pets || []);
  if (logSearchInput) logSearchInput.value = session.logQuery || '';
  renderLogs(getFilteredLogs(session));
  renderShops(session.shops || { seed: [], tool: [], egg: [], decor: [], restock: {} });

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
  session.pets = [];
  session.logs = [];
  session.shops = { seed: [], tool: [], egg: [], decor: [], restock: {} };
};

async function removeSession(id) {
  const index = sessions.findIndex((session) => session.id === id);
  if (index === -1) return;
  const [removed] = sessions.splice(index, 1);
  if (removed?.connected || removed?.busy) {
    await window.api.disconnect({ sessionId: removed.id });
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
};

const saveInputs = () => {
  const session = getActiveSession();
  if (!session) return;
  session.cookie = cookieInput.value;
  if (roomInput) session.room = roomInput.value;
  persistSessions();
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
  message.textContent = `${payload.action || 'Ability'}${pet}`;

  row.appendChild(message);

  item.appendChild(time);
  item.appendChild(row);
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
  if (!formCard || !shopsCard || !statusCard || !stackColumn) return;
  if (logsCard?.style.height) logsCard.style.height = '';
  if (!window.matchMedia('(min-width: 861px)').matches) {
    if (shopsCard.style.height) shopsCard.style.height = '';
    if (stackColumn.style.height) stackColumn.style.height = '';
    return;
  }
  const formRect = formCard.getBoundingClientRect();

  const statusRect = statusCard.getBoundingClientRect();
  const span = statusRect.bottom - formRect.top;
  if (span > 0) {
    const next = `${Math.ceil(span)}px`;
    if (shopsCard.style.height !== next) {
      shopsCard.style.height = next;
    }
    if (stackColumn.style.height !== next) {
      stackColumn.style.height = next;
    }
  }
};

loadSessions();
setActiveSession(activeSessionId);
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
  const url = openGameSelect?.value || 'https://magicgarden.gg';
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
    if (session === getActiveSession()) {
      applySessionToUI(session);
    }
  }
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

window.api.onLiveStatus((payload) => {
  if (!payload) return;
  const session = getSessionById(payload.sessionId);
  if (!session) return;
  session.playerName = payload.playerName || '-';
  session.roomId = payload.roomId || '-';
  if (payload.playerId) session.playerId = payload.playerId;
  session.pets = Array.isArray(payload.pets) ? payload.pets : [];
  if (payload.playerName && session.autoName) {
    session.name = payload.playerName;
    persistSessions();
    renderTabs();
  }
  if (session === getActiveSession()) {
    if (playerNameValue) playerNameValue.textContent = session.playerName;
    if (roomIdValue) roomIdValue.textContent = session.roomId;
    if (playerIdValue) playerIdValue.textContent = session.playerId || '-';
    renderPets(session.pets);
    syncLogHeight();
  }
});

window.api.onShops?.((payload) => {
  if (!payload) return;
  const session = getSessionById(payload.sessionId);
  if (!session) return;
  session.shops = payload;
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

