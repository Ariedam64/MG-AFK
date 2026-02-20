import { DEFAULT_GAME_URL, RECONNECT_GROUPS, RECONNECT_DELAY_KEYS, RECONNECT_DELAY_LIMITS } from './lib/constants.js';
import {
  cookieInput,
  roomInput,
  toggleBtn,
  errorText,
  logSearchInput,
  alertShopSelect,
  alertNotifySelect,
  openGameSelect,
  checkUpdateBtn,
  openUpdateBtn,
  openGameBtn,
  toggleDevBtn,
  devBackBtn,
  addTabBtn,
  logList,
  trafficSearchInput,
  connSearchInput,
  trafficCopyAllBtn,
  trafficClearBtn,
  connCopyAllBtn,
  connClearBtn,
  reconnectInputs,
  reconnectDelayInputs,
  reconnectDelayValues,
  appRoot,
  playerIdValue,
  playerNameValue,
  roomIdValue,
  weatherValue,
  playersValue,
  uptimeValue,
  reconnectCountdown,
  shopSeedList,
  shopToolList,
  shopEggList,
  shopDecorList,
  shopSeedRestock,
  shopToolRestock,
  shopEggRestock,
  shopDecorRestock,
} from './lib/dom.js';
import { sessions, activeSessionId, getActiveSession, getSessionById } from './lib/state.js';
import { setStatusChip } from './lib/status.js';
import { renderPets } from './lib/pets.js';
import { updateWeatherIcon, resetWeatherIconKey } from './lib/weather.js';
import { renderLogs, getFilteredLogs, syncLogHeight, scheduleLogRender } from './lib/logs.js';
import {
  renderTrafficLogs, renderConnLogs, setDevView,
  pushTrafficLog, pushConnLog,
  exportTrafficLogs, exportConnLogs,
  clearTrafficLogs, clearConnLogs,
} from './lib/devtools.js';
import { scheduleResize } from './lib/resize.js';
import {
  reconnectState,
  setupReconnectAnimation,
  buildReconnectConfig,
} from './lib/reconnect.js';
import { syncTraySession, syncAllTraySessions } from './lib/tray.js';
import {
  createSession,
  persistSessions,
  loadSessions,
  setActiveSession,
  removeSession,
  saveInputs,
  resetSessionStats,
  setError,
  setBusy,
  setConnected,
  applySessionToUI,
  setCallbacks,
} from './lib/sessions.js';
import {
  alertState,
  persistAlertState,
  updateAlertCatalog,
  renderAlertTable,
  applyAlertStateToUI,
  checkShopAlerts,
  checkShopRestocks,
  checkWeatherAlerts,
  checkPetHungerAlerts,
  maybeMigrateLegacyAlerts,
} from './lib/alerts.js';
import { renderTabs } from './lib/tabs.js';
import { runUpdateCheck } from './lib/update.js';

// Wire cross-module callbacks to break circular dependency
setCallbacks({ applyAlertStateToUI, renderTabs });

// --- Init ---
loadSessions(maybeMigrateLegacyAlerts);
syncAllTraySessions();
setActiveSession(activeSessionId.value);
window.spriteResolver?.preload?.();
setupReconnectAnimation(scheduleResize);

// --- DOM event listeners ---
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

toggleDevBtn?.addEventListener('click', () => setDevView(true));
devBackBtn?.addEventListener('click', () => setDevView(false));

trafficCopyAllBtn?.addEventListener('click', async () => {
  await exportTrafficLogs(getActiveSession(), trafficCopyAllBtn);
});
trafficClearBtn?.addEventListener('click', () => {
  clearTrafficLogs(getActiveSession());
});
connCopyAllBtn?.addEventListener('click', async () => {
  await exportConnLogs(getActiveSession(), connCopyAllBtn);
});
connClearBtn?.addEventListener('click', () => {
  clearConnLogs(getActiveSession());
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
  const baseUrl = openGameSelect?.value || DEFAULT_GAME_URL;
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

// --- Tray IPC ---
const toggleSessionConnection = async (sessionId) => {
  const session = sessionId ? getSessionById(sessionId) : getActiveSession();
  if (!session || session.busy) return;
  if (sessionId && session.id !== activeSessionId.value) {
    setActiveSession(session.id);
  }
  toggleBtn.click();
};

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

// --- IPC event handlers ---
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
      resetWeatherIconKey();
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
  if (session === getActiveSession() && window.shopsView) {
    window.shopsView.renderShops(
      {
        seed: { list: shopSeedList, restock: shopSeedRestock },
        tool: { list: shopToolList, restock: shopToolRestock },
        egg: { list: shopEggList, restock: shopEggRestock },
        decor: { list: shopDecorList, restock: shopDecorRestock },
      },
      payload,
    );
  }
});

// --- Layout & resize ---
document.fonts.ready.then(() => {
  syncLogHeight();
  scheduleResize();
  requestAnimationFrame(() => {
    const loader = document.getElementById('appLoader');
    if (loader) loader.classList.add('hidden');
    appRoot.classList.add('ready');
    if (loader) loader.addEventListener('transitionend', () => loader.remove(), { once: true });
  });
  runUpdateCheck({ showProgress: false });
});

if (appRoot && 'ResizeObserver' in window) {
  const observer = new ResizeObserver(() => scheduleResize());
  observer.observe(appRoot);
}
