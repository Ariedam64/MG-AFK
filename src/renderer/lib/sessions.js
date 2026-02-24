import { DEFAULT_RECONNECT, DEFAULT_GAME_URL, storageKeys } from './constants.js';
import {
  cookieInput,
  roomInput,
  toggleBtn,
  errorText,
  openGameSelect,
  playersValue,
  uptimeValue,
  playerIdValue,
  playerNameValue,
  roomIdValue,
  weatherValue,
  reconnectCountdown,
  logSearchInput,
  trafficSearchInput,
  connSearchInput,
  shopSeedList,
  shopToolList,
  shopEggList,
  shopDecorList,
  shopSeedRestock,
  shopToolRestock,
  shopEggRestock,
  shopDecorRestock,
} from './dom.js';
import { clone, generateSessionId } from './utils.js';
import { sessions, activeSessionId, getActiveSession } from './state.js';
import { syncTraySession, syncAllTraySessions } from './tray.js';
import { renderPets } from './pets.js';
import { renderLogs, getFilteredLogs, syncLogHeight } from './logs.js';
import { renderTrafficLogs, renderConnLogs } from './devtools.js';
import { normalizeReconnect, reconnectState, setReconnectState, updateReconnectUI } from './reconnect.js';
import { scheduleResize } from './resize.js';
import { setStatusChip } from './status.js';
import { updateWeatherIcon } from './weather.js';

let _applyAlertStateToUI = null;
let _renderTabs = null;
let _syncAuthButtons = null;

export const setCallbacks = ({ applyAlertStateToUI, renderTabs, syncAuthButtons }) => {
  _applyAlertStateToUI = applyAlertStateToUI;
  _renderTabs = renderTabs;
  _syncAuthButtons = syncAuthButtons;
};

const buildSessionName = (index) => `Account ${index}`;

export const createSession = (seed = {}, index = 1) => {
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

export const persistSessions = () => {
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
  localStorage.setItem(storageKeys.activeSession, activeSessionId.value);
  syncAllTraySessions();
};

export const setError = (msg) => {
  const session = getActiveSession();
  if (session) session.error = msg ? String(msg) : '';
  errorText.textContent = msg ? String(msg) : '';
};

export const setBusy = (session, value) => {
  if (!session) return;
  session.busy = value;
  if (session === getActiveSession()) {
    toggleBtn.disabled = value;
  }
};

export const setConnected = (session, value) => {
  if (!session) return;
  session.connected = value;
  if (session !== getActiveSession()) return;
  toggleBtn.textContent = value ? 'Disconnect' : 'Connect';
  toggleBtn.classList.toggle('secondary', value);
  toggleBtn.classList.toggle('primary', !value);
  if (roomInput) roomInput.disabled = value;
};

export const resetSessionStats = (session) => {
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

export const applySessionToUI = (session) => {
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
  if (_applyAlertStateToUI) _applyAlertStateToUI();
  _syncAuthButtons?.();

  if (!session.reconnect) session.reconnect = clone(DEFAULT_RECONNECT);
  setReconnectState(session.reconnect);
  updateReconnectUI();
  syncLogHeight();
  scheduleResize();
};

export const setActiveSession = (id) => {
  const target = sessions.find((session) => session.id === id) || sessions[0];
  if (!target) return;
  activeSessionId.value = target.id;
  persistSessions();
  applySessionToUI(target);
  if (_renderTabs) _renderTabs();
  if (window.api?.setActiveSession) {
    window.api.setActiveSession({ sessionId: activeSessionId.value });
  }
  syncTraySession(target);
};

export const removeSession = async (id) => {
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
  if (activeSessionId.value === id) {
    const next = sessions[Math.min(index, sessions.length - 1)];
    setActiveSession(next.id);
    return;
  }
  persistSessions();
  if (_renderTabs) _renderTabs();
};

export const saveInputs = () => {
  const session = getActiveSession();
  if (!session) return;
  session.cookie = cookieInput.value;
  if (roomInput) session.room = roomInput.value;
  persistSessions();
};

export const loadSessions = (maybeMigrateLegacyAlerts) => {
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
  if (maybeMigrateLegacyAlerts) maybeMigrateLegacyAlerts(parsed);
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
  activeSessionId.value =
    localStorage.getItem(storageKeys.activeSession) || sessions[0]?.id || '';
  if (!sessions.find((session) => session.id === activeSessionId.value)) {
    activeSessionId.value = sessions[0]?.id || '';
  }
};
