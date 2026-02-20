import {
  storageKeys,
  SHOP_LABELS,
  RESTOCK_SECONDS,
  WEATHER_ALERTS,
  PET_HUNGER_ALERT_ITEM,
  PET_HUNGER_THRESHOLD,
  DEFAULT_ALERT_STATE,
} from './constants.js';
import { alertRows, alertShopSelect, alertNotifySelect } from './dom.js';
import { clone, isAlertShop, getPetHungerPct, getPetKey, getPetLabel } from './utils.js';
import { sessions } from './state.js';
import {
  notifyShopRestock,
  notifyWeatherChange,
  notifyPetHunger,
  playAlertSound,
  getNotifyMode,
} from './notifications.js';
import { resolveWeatherKey, resolveWeatherIconUrl } from './weather.js';

export const getAlertKey = (shop, item) => `${shop}|${item}`;
export const PET_HUNGER_ALERT_KEY = getAlertKey('pet', PET_HUNGER_ALERT_ITEM);

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

const loadAlertStateFromStorage = () => {
  const raw = localStorage.getItem(storageKeys.alerts);
  if (!raw) return normalizeAlertState(null);
  try {
    return normalizeAlertState(JSON.parse(raw));
  } catch {
    return normalizeAlertState(null);
  }
};

export let alertState = loadAlertStateFromStorage();

export const persistAlertState = () => {
  const payload = {
    shop: alertState.shop,
    notifyMode: alertState.notifyMode || 'windows',
    selected: alertState.selected || {},
    catalog: alertState.catalog || {},
  };
  localStorage.setItem(storageKeys.alerts, JSON.stringify(payload));
};

export const updateAlertCatalog = (catalog) => {
  const nextCatalog = normalizeAlertCatalog(catalog);
  alertState.catalog = nextCatalog;
  persistAlertState();
};

export const resetPetHungerState = () => {
  sessions.forEach((session) => {
    session.petHungerAlerts = {};
    session.petHungerInitialized = false;
  });
};

export const checkPetHungerAlerts = (session) => {
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
    notifyPetHunger(newlyLow, alertState);
  }
};

const shouldNotifyRestock = (shopKey, items) => {
  if (!items.length) return false;
  const alerts = alertState.selected || {};
  return items.some((item) => alerts[getAlertKey(shopKey, item.name)]);
};

export const checkWeatherAlerts = (session, nextWeather) => {
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
  notifyWeatherChange(nextWeather, alertState);
};

export const checkShopRestocks = (session, payload) => {
  if (!session || !payload?.restock) return;
  const prev = session.restockTimers || {};
  const next = payload.restock || {};
  const initialized = session.restockInitialized;
  session.restockTimers = { ...next };
  session.restockInitialized = true;
  if (!initialized) return;
  const soundOnly = getNotifyMode(alertState) === 'sound';
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
    notifyShopRestock(label, selectedItems, alertState);
  });
  if (soundOnly && shouldPlaySound) {
    void playAlertSound();
  }
};

export const checkShopAlerts = () => {
  const catalog = alertState.catalog || {};
  const triggered = alertState.triggered || {};
  Object.entries(SHOP_LABELS).forEach(([shopKey]) => {
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
    rows.push({
      shopKey: selectedShop,
      item: entry.name,
      key: entry.name,
      stock: entry.stock,
    });
  });

  return rows;
};

export const renderAlertTable = () => {
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

export const applyAlertStateToUI = () => {
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

export const setAlertState = (value) => {
  alertState = value;
};

export const maybeMigrateLegacyAlerts = (parsed) => {
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
