import { logList, logSpacer, logItems, formCard, shopsColumn, statusCard, stackColumn, logsCard } from './dom.js';
import { formatLogTime } from './utils.js';

export const logVirtualState = {
  items: [],
  itemHeight: 0,
  itemGap: 0,
  itemBaseHeight: 0,
  buffer: 6,
  renderFrame: null,
  lastStart: -1,
  lastEnd: -1,
};

export const createLogElement = (payload) => {
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

export const scheduleLogRender = () => {
  if (logVirtualState.renderFrame) return;
  logVirtualState.renderFrame = window.requestAnimationFrame(() => {
    logVirtualState.renderFrame = null;
    renderVirtualLogs();
  });
};

export const renderLogs = (logs) => {
  const items = Array.isArray(logs) ? logs : [];
  logVirtualState.items = items;
  logVirtualState.lastStart = -1;
  logVirtualState.lastEnd = -1;
  scheduleLogRender();
};

export const getFilteredLogs = (session) => {
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

export const syncLogHeight = () => {
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
