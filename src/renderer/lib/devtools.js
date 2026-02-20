import { trafficList, connList, mainView, devView, appRoot } from './dom.js';
import { formatLogTime, truncateText, copyTextToClipboard } from './utils.js';
import { DEV_LOG_LIMIT } from './constants.js';
import { getActiveSession } from './state.js';
import { getLastSize, getLastMainSize, setLastMainSize } from './resize.js';

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

export const buildTrafficEntry = (payload) => {
  const ts = Number(payload?.ts) || Date.now();
  const direction = payload?.direction === 'out' ? 'out' : 'in';
  const text = String(payload?.text || '');
  const { parsed, type } = parseTrafficMessage(text);
  const copyText = parsed ? JSON.stringify(parsed, null, 2) : text;
  const preview = truncateText(parsed ? JSON.stringify(parsed) : text);
  const search = `${direction} ${type} ${text}`.toLowerCase();
  return { ts, direction, text, type, preview, copyText, search };
};

export const buildConnEntry = (payload) => {
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
  } else if (lc.includes('reconnect skipped')) {
    badge = 'NO RECONNECT';
    badgeClass = 'warn';
  } else if (lc.includes('reconnect exhausted')) {
    badge = 'EXHAUSTED';
    badgeClass = 'error';
  } else if (lc.includes('game action')) {
    badge = 'ACTION';
    badgeClass = 'info';
  } else if (level.toLowerCase() === 'error') {
    badge = 'ERROR';
    badgeClass = 'error';
  }
  // "ws closed" emits "code=4250", "ws disconnected" emits trailing "4250"
  const codeEq = detail.match(/\bcode=(\d+)/);
  const codeTrailing = detail.match(/\s+(\d+)\s*$/);
  const code = codeEq ? codeEq[1] : (codeTrailing ? codeTrailing[1] : '');
  if (code === '4250' || code === '4300') {
    badge = 'SUPERSEDED';
    badgeClass = 'warn';
  }
  return { ts, level, message, detail, preview, copyText, search, badge, badgeClass, code };
};

const filterDevLogs = (logs, query) => {
  const term = String(query || '').trim().toLowerCase();
  if (!term) return logs;
  return logs.filter((entry) => entry.search.includes(term));
};

const flashCopied = (btn, original) => {
  btn.textContent = 'Copied!';
  btn.classList.add('dev-copy-success');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('dev-copy-success');
  }, 1500);
};

export const renderTrafficLogs = (session) => {
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
    row.className = 'dev-row dev-row-expandable';
    row.title = 'Click to expand';

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
      type.className = 'dev-type-pill';
      type.textContent = entry.type;
      meta.appendChild(type);
    }

    const text = document.createElement('div');
    text.className = 'dev-text';
    text.textContent = entry.preview;

    const full = document.createElement('div');
    full.className = 'dev-full hidden';
    const pre = document.createElement('pre');
    pre.className = 'dev-pre';
    pre.textContent = entry.copyText;
    full.appendChild(pre);

    left.appendChild(meta);
    left.appendChild(text);
    left.appendChild(full);

    const copyLabel = entry.type ? 'Copy JSON' : 'Copy';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'dev-copy';
    copyBtn.textContent = copyLabel;
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await copyTextToClipboard(entry.copyText);
      flashCopied(copyBtn, copyLabel);
    });

    row.addEventListener('click', () => {
      const expanded = row.classList.toggle('expanded');
      full.classList.toggle('hidden', !expanded);
      row.title = expanded ? 'Click to collapse' : 'Click to expand';
    });

    row.appendChild(left);
    row.appendChild(copyBtn);
    trafficList.appendChild(row);
  });
};

export const renderConnLogs = (session) => {
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
    row.className = 'dev-row dev-row-expandable';
    row.title = 'Click to expand';

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
      code.className = 'dev-type-pill';
      code.textContent = `Code ${entry.code}`;
      meta.appendChild(code);
    }

    const title = document.createElement('div');
    title.className = 'dev-text';
    title.textContent = entry.message || entry.preview;

    const full = document.createElement('div');
    full.className = 'dev-full hidden';
    const pre = document.createElement('pre');
    pre.className = 'dev-pre';
    pre.textContent = entry.detail || entry.copyText;
    full.appendChild(pre);

    left.appendChild(meta);
    left.appendChild(title);
    left.appendChild(full);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'dev-copy';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await copyTextToClipboard(entry.copyText);
      flashCopied(copyBtn, 'Copy');
    });

    row.addEventListener('click', () => {
      const expanded = row.classList.toggle('expanded');
      full.classList.toggle('hidden', !expanded);
      row.title = expanded ? 'Click to collapse' : 'Click to expand';
    });

    row.appendChild(left);
    row.appendChild(copyBtn);
    connList.appendChild(row);
  });
};

const buildExportText = (logs, label) => {
  if (!logs.length) return `=== ${label} - empty ===`;
  const date = new Date().toLocaleString('fr-FR');
  const lines = [`=== ${label} — ${date} ===`, ''];
  logs.forEach((entry) => {
    const time = formatLogTime(entry.ts);
    if (entry.direction !== undefined) {
      const dir = entry.direction === 'out' ? 'OUT' : 'IN ';
      const type = entry.type ? ` [${entry.type}]` : '';
      lines.push(`[${time}] ${dir}${type} ${entry.text}`);
    } else {
      const detail = entry.detail ? ` | ${entry.detail}` : '';
      lines.push(`[${time}] ${entry.badge} | ${entry.message}${detail}`);
    }
  });
  return lines.join('\n');
};

export const exportTrafficLogs = async (session, btn) => {
  const logs = filterDevLogs(session?.trafficLogs || [], session?.trafficQuery);
  const text = buildExportText(logs, 'WS Traffic');
  await copyTextToClipboard(text);
  if (btn) flashCopied(btn, 'Export');
};

export const exportConnLogs = async (session, btn) => {
  const logs = filterDevLogs(session?.connLogs || [], session?.connQuery);
  const text = buildExportText(logs, 'Connection Logs');
  await copyTextToClipboard(text);
  if (btn) flashCopied(btn, 'Export');
};

export const clearTrafficLogs = (session) => {
  if (!session) return;
  session.trafficLogs = [];
  renderTrafficLogs(session);
};

export const clearConnLogs = (session) => {
  if (!session) return;
  session.connLogs = [];
  renderConnLogs(session);
};

export const setDevView = (show) => {
  if (!mainView || !devView) return;
  const next = Boolean(show);

  if (next) {
    // Snapshot the current window size so we can restore it on exit.
    // The dev panel always shows within the existing window — no resize on enter.
    const lastSize = getLastSize();
    if (lastSize.width && lastSize.height) {
      setLastMainSize({ ...lastSize });
    } else if (appRoot) {
      const rect = appRoot.getBoundingClientRect();
      if (rect.width && rect.height) {
        setLastMainSize({
          width: Math.ceil(rect.width + 8),
          height: Math.ceil(rect.height + 8),
        });
      }
    }
  } else {
    // Restore the main-panel window size. Because we never resize on enter,
    // the window is already at this size; the call is a safety net only.
    const lastMainSize = getLastMainSize();
    if (lastMainSize && window.api?.resizeTo) {
      window.api.resizeTo({ ...lastMainSize });
    }
  }

  mainView.classList.toggle('hidden', next);
  devView.classList.toggle('hidden', !next);

  const session = getActiveSession();
  if (next && session) {
    renderTrafficLogs(session);
    renderConnLogs(session);
  }
};

export const pushTrafficLog = (session, payload) => {
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

export const pushConnLog = (session, payload) => {
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
