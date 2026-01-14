'use strict';

const cookieInput = document.getElementById('cookieInput');
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
const updateStatus = document.getElementById('updateStatus');
const appRoot = document.querySelector('.app');
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
  cookie: 'mgafk.cookie',
  reconnect: 'mgafk.reconnect',
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

let connected = false;
let busy = false;
let lastSize = { width: 0, height: 0 };
let reconnectState = JSON.parse(JSON.stringify(DEFAULT_RECONNECT));

const setError = (msg) => {
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

const setBusy = (value) => {
  busy = value;
  toggleBtn.disabled = busy;
};

const setConnected = (value) => {
  connected = value;
  toggleBtn.textContent = connected ? 'Disconnect' : 'Connect';
  toggleBtn.classList.toggle('secondary', connected);
  toggleBtn.classList.toggle('primary', !connected);
  cookieInput.disabled = connected;
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

const saveInputs = () => {
  localStorage.setItem(storageKeys.cookie, cookieInput.value);
};

const loadInputs = () => {
  cookieInput.value = localStorage.getItem(storageKeys.cookie) || '';
  localStorage.removeItem('mgafk.room');
  localStorage.removeItem('mgafk.version');
};

const saveReconnect = () => {
  localStorage.setItem(storageKeys.reconnect, JSON.stringify(reconnectState));
};

const loadReconnect = () => {
  const raw = localStorage.getItem(storageKeys.reconnect);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (Number.isFinite(parsed.delayMs)) {
        reconnectState.delays.supersededMs = parsed.delayMs;
        reconnectState.delays.otherMs = parsed.delayMs;
      }
      if (parsed.delays && typeof parsed.delays === 'object') {
        for (const [key, value] of Object.entries(parsed.delays)) {
          if (!Number.isFinite(value)) continue;
          if (Object.prototype.hasOwnProperty.call(reconnectState.delays, key)) {
            reconnectState.delays[key] = value;
            continue;
          }
          if (key === 'updateMs' && !Number.isFinite(parsed.delays.otherMs)) {
            reconnectState.delays.otherMs = value;
          }
        }
      }
      if (typeof parsed.unknown === 'boolean') {
        reconnectState.unknown = parsed.unknown;
      }
      if (parsed.codes && typeof parsed.codes === 'object') {
        reconnectState.codes = { ...reconnectState.codes, ...parsed.codes };
      }
    }
  } catch {
    // ignore invalid data
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

const resetStats = () => {
  playersValue.textContent = '0';
  uptimeValue.textContent = '00:00:00';
  playerIdValue.textContent = '-';
  if (playerNameValue) playerNameValue.textContent = '-';
  if (roomIdValue) roomIdValue.textContent = '-';
  if (petList) petList.innerHTML = '';
  if (window.shopsView) {
    window.shopsView.renderShops(
      {
        seed: { list: shopSeedList, restock: shopSeedRestock },
        tool: { list: shopToolList, restock: shopToolRestock },
        egg: { list: shopEggList, restock: shopEggRestock },
        decor: { list: shopDecorList, restock: shopDecorRestock },
      },
      { seed: [], tool: [], egg: [], decor: [], restock: {} },
    );
  }
  setUpdateStatus('');
  if (openUpdateBtn) openUpdateBtn.classList.add('hidden');
};

const getHungerLimit = (species) => {
  const key = String(species || '')
    .toLowerCase()
    .replace(/\s+/g, '');
  return PET_HUNGER_COSTS[key] || null;
};

const addLog = (payload) => {
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
  logList.prepend(item);

  while (logList.children.length > 200) {
    logList.removeChild(logList.lastChild);
  }
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
      requestResize();
    });
  };
})();

const syncLogHeight = () => {
  if (!statusCard || !petCard || !logsCard) return;
  const grid = statusCard.closest('.compact-grid');
  const styles = grid ? window.getComputedStyle(grid) : null;
  const gap = styles ? parseFloat(styles.rowGap) || 0 : 0;
  const height = statusCard.offsetHeight + petCard.offsetHeight + gap;
  if (height > 0) {
    const next = `${height}px`;
    if (logsCard.style.height !== next) {
      logsCard.style.height = next;
    }
  }
  if (!formCard || !shopsCard) return;
  if (!window.matchMedia('(min-width: 861px)').matches) {
    if (shopsCard.style.height) shopsCard.style.height = '';
    return;
  }
  const formRect = formCard.getBoundingClientRect();
  const logsRect = logsCard.getBoundingClientRect();
  const span = logsRect.bottom - formRect.top;
  if (span > 0) {
    const next = `${Math.ceil(span)}px`;
    if (shopsCard.style.height !== next) {
      shopsCard.style.height = next;
    }
  }
};

loadInputs();
loadReconnect();
updateReconnectUI();
setupReconnectAnimation();
cookieInput.addEventListener('input', saveInputs);
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
    saveReconnect();
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
    saveReconnect();
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
  await window.api.openExternal('https://magicgarden.gg');
});

toggleBtn.addEventListener('click', async () => {
  if (busy) return;
  setError('');

  if (connected) {
    setBusy(true);
    await window.api.disconnect();
    setBusy(false);
    return;
  }

  const cookie = cookieInput.value.trim();

  if (!cookie) {
    setError('Cookie is required.');
    return;
  }

  logList.innerHTML = '';
  resetStats();
  setBusy(true);
  setStatusChip('connecting');
  const result = await window.api.connect({
    cookie,
    reconnect: buildReconnectConfig(),
  });
  setBusy(false);
  if (result && result.playerId) playerIdValue.textContent = result.playerId;
  if (result && result.error) setError(result.error);
});

window.api.onStatus((payload) => {
  if (!payload || !payload.state) return;
  if (payload.state === 'connected') {
    setConnected(true);
    setStatusChip('connected');
    setError('');
    if (reconnectCountdown) reconnectCountdown.textContent = '';
    if (payload.playerId) playerIdValue.textContent = payload.playerId;
    return;
  }

  if (payload.state === 'connecting') {
    setConnected(false);
    setStatusChip('connecting');
    setError('');
    if (reconnectCountdown) reconnectCountdown.textContent = '';
    return;
  }

  if (payload.state === 'reconnecting') {
    setConnected(false);
    setStatusChip('connecting');
    const remaining = Math.max(0, Math.ceil((payload.retryInMs || 0) / 1000));
    if (reconnectCountdown) {
      const attempt = payload.retry && payload.maxRetries
        ? ` (${payload.retry}/${payload.maxRetries})`
        : '';
      reconnectCountdown.textContent =
        remaining > 0 ? `Reconnect in ${remaining}s${attempt}` : `Reconnecting...${attempt}`;
    }
    return;
  }

  if (payload.state === 'error') {
    setError(payload.message || 'Connection error.');
    setConnected(false);
    setStatusChip('error');
    resetStats();
    if (reconnectCountdown) reconnectCountdown.textContent = '';
    return;
  }

  if (payload.state === 'disconnected') {
    setConnected(false);
    setStatusChip('idle');
    resetStats();
    if (reconnectCountdown) reconnectCountdown.textContent = '';
    return;
  }
});

window.api.onPlayers((payload) => {
  if (payload && typeof payload.count === 'number') {
    playersValue.textContent = String(payload.count);
  }
});

window.api.onUptime((payload) => {
  if (payload && payload.text) uptimeValue.textContent = payload.text;
});

window.api.onAbilityLog((payload) => {
  if (payload) addLog(payload);
});

window.api.onLiveStatus((payload) => {
  if (!payload) return;
  if (playerNameValue) playerNameValue.textContent = payload.playerName || '-';
  if (roomIdValue) roomIdValue.textContent = payload.roomId || '-';
  if (petList) {
    petList.innerHTML = '';
    const pets = Array.isArray(payload.pets) ? payload.pets : [];
    if (pets.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pet-empty';
      empty.textContent = 'No pets';
      petList.appendChild(empty);
    } else {
      pets.forEach((pet) => {
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
    }
  }
  syncLogHeight();
});

window.api.onShops?.((payload) => {
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
});

resetStats();
setConnected(false);
setStatusChip('idle');
syncLogHeight();
scheduleResize();
window.addEventListener('load', () => runUpdateCheck({ showProgress: false }));

if (appRoot && 'ResizeObserver' in window) {
  const observer = new ResizeObserver(() => scheduleResize());
  observer.observe(appRoot);
}

window.addEventListener('load', () => scheduleResize());

