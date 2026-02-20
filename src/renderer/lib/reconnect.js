import {
  DEFAULT_RECONNECT,
  RECONNECT_GROUPS,
  RECONNECT_DELAY_KEYS,
  RECONNECT_DELAY_LIMITS,
} from './constants.js';
import {
  reconnectInputs,
  reconnectDelayInputs,
  reconnectDelayValues,
  reconnectDetails,
  reconnectBody,
} from './dom.js';
import { clone } from './utils.js';

export let reconnectState = clone(DEFAULT_RECONNECT);

export const setReconnectState = (value) => {
  reconnectState = value;
};

export const normalizeReconnect = (value) => {
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

export const updateReconnectUI = () => {
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

export const buildReconnectConfig = () => ({
  delays: { ...reconnectState.delays },
  unknown: reconnectState.unknown,
  codes: { ...reconnectState.codes },
});

export const setupReconnectAnimation = (scheduleResizeFn) => {
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
      scheduleResizeFn();
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
      scheduleResizeFn();
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
