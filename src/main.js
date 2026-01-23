'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  shell,
  Tray,
  Menu,
  nativeImage,
  Notification,
} = require('electron');
const { fetchGameVersion } = require('./assets/gameVersion');
const { getAssetUrl } = require('./assets/assets');
const { loadManifest } = require('./assets/manifest');
const { RoomClient } = require('./ws/roomClient');

let mainWindow = null;
const clients = new Map();
const sessionStates = new Map();
let activeSessionId = '';
let tray = null;
let isQuitting = false;
let trayUpdateStatus = '';

const sendToRenderer = (channel, payload) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, payload);
  }
};

const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString('fr-FR', { hour12: false });

const emitDebug = (level, message, detail, sessionId) => {
  const ts = Date.now();
  const sessionTag = sessionId ? `session=${sessionId}` : '';
  const fullDetail = [sessionTag, detail].filter(Boolean).join(' ');
  const line = `[${fmtTime(ts)}] [${level}] ${message}${
    fullDetail ? ` | ${fullDetail}` : ''
  }`;
  console.log(line);
  sendToRenderer('ws:debug', { level, message, detail: fullDetail, ts, sessionId });
};

const resolveSessionId = (value) => {
  const text = String(value || '').trim();
  return text || 'default';
};

const getTraySession = () => {
  if (activeSessionId && sessionStates.has(activeSessionId)) {
    return sessionStates.get(activeSessionId);
  }
  const first = sessionStates.values().next();
  return first.done ? null : first.value;
};

const buildRoomUrl = (session) => {
  if (!session) return '';
  const base = String(session.gameUrl || 'https://magicgarden.gg').replace(/\/+$/, '');
  const room = session.roomId || session.room || '';
  return room ? `${base}/r/${room}` : base;
};

const showMainWindow = () => {
  if (!mainWindow) {
    createWindow();
  }
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
};

const toggleWindow = () => {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showMainWindow();
  }
  updateTrayMenu();
};

const getTrayIconPath = () => {
  const candidates = [
    path.join(app.getAppPath(), 'mgafk.ico'),
    path.join(process.resourcesPath || '', 'mgafk.ico'),
    path.join(__dirname, '..', 'mgafk.ico'),
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || candidates[0];
};

const formatPetLabel = (pet) => {
  if (!pet) return '';
  const label = pet.label || '';
  if (!label) return '';
  if (!Number.isFinite(pet.hungerPct)) return label;
  return `${label} — ${Math.round(pet.hungerPct)}%`;
};

const updateTrayMenu = () => {
  if (!tray) return;
  const session = getTraySession();
  const connected = Boolean(session?.connected);
  const showLabel =
    mainWindow && mainWindow.isVisible() ? 'Hide' : 'Show';
  const sessionsMenu = Array.from(sessionStates.values()).map((value) => {
    const isActive = value.id === activeSessionId;
    const petItems = Array.isArray(value.pets) ? value.pets : [];
    const petMenu = petItems.length
      ? petItems.map((pet) => ({
        label: formatPetLabel(pet),
        enabled: false,
      }))
      : [{ label: 'No pets', enabled: false }];
    return {
      label: value.name || value.id,
      submenu: [
        {
          label: value.connected ? 'Disconnect' : 'Connect',
          click: () => {
            sendToRenderer('tray:toggle-connection', { sessionId: value.id });
          },
        },
        {
          label: 'Open game',
          click: () => {
            const url = buildRoomUrl(value);
            if (url) shell.openExternal(url);
          },
        },
        { type: 'separator' },
        ...petMenu,
      ],
    };
  });

  const template = [
    {
      label: showLabel,
      click: () => toggleWindow(),
    },
    {
      label: 'Check update',
      click: () => sendToRenderer('tray:check-update', {}),
    },
    ...(trayUpdateStatus
      ? [{ label: trayUpdateStatus, enabled: false }]
      : []),
    { type: 'separator' },
    {
      label: 'Sessions',
      submenu: sessionsMenu.length
        ? sessionsMenu
        : [{ label: 'No sessions', enabled: false }],
    },
    { type: 'separator' },
    {
      label: 'Quit MG AFK',
      click: () => {
        isQuitting = true;
        tray?.destroy();
        tray = null;
        app.quit();
      },
    },
  ];

  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.setToolTip(trayUpdateStatus ? `MG AFK - ${trayUpdateStatus}` : 'MG AFK');
};

const createTray = () => {
  if (tray) return;
  const iconPath = getTrayIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip('MG AFK');
  tray.on('click', toggleWindow);
  tray.on('double-click', toggleWindow);
  tray.on('balloon-click', () => showMainWindow());
  updateTrayMenu();
};

const bindClient = (client, sessionId) => {
  client.on('status', (payload) => {
    sendToRenderer('ws:status', { sessionId, ...payload });
    if (!payload || !payload.state) return;
    if (payload.state === 'error') {
      const detail = payload.message || payload.reason || 'unknown';
      emitDebug('error', 'ws error', detail, sessionId);
      return;
    }
    if (payload.state === 'disconnected') {
      const detail = payload.reason
        ? `${payload.code || ''} ${payload.reason}`.trim()
        : String(payload.code || '');
      emitDebug('info', 'ws disconnected', detail, sessionId);
      return;
    }
    emitDebug('info', 'ws status', payload.state, sessionId);
  });

  client.on('players', (payload) => {
    sendToRenderer('ws:players', { sessionId, ...payload });
    if (payload && typeof payload.count === 'number') {
      emitDebug('info', 'players update', String(payload.count), sessionId);
    }
  });

  client.on('uptime', (payload) => sendToRenderer('ws:uptime', { sessionId, ...payload }));
  client.on('abilityLog', (payload) => sendToRenderer('ws:abilityLog', { sessionId, ...payload }));
  client.on('traffic', (payload) => sendToRenderer('ws:traffic', { sessionId, ...payload }));
  client.on('liveStatus', (payload) => sendToRenderer('ws:liveStatus', { sessionId, ...payload }));
  client.on('shops', (payload) => sendToRenderer('ws:shops', { sessionId, ...payload }));
  client.on('debug', (payload) => {
    if (!payload) return;
    emitDebug(
      payload.level || 'info',
      payload.message || 'debug',
      payload.detail || '',
      sessionId,
    );
  });
  client.on('gameAction', (payload) => {
    if (!payload) return;
    const detail = payload.gameName ? `${payload.type} | ${payload.gameName}` : payload.type;
    emitDebug('info', 'game action', detail, sessionId);
  });
};

const getClient = (sessionId) => {
  const key = resolveSessionId(sessionId);
  if (clients.has(key)) return clients.get(key);
  const client = new RoomClient();
  bindClient(client, key);
  clients.set(key, client);
  return client;
};

const fetchLatestVersion = (logger) => fetchGameVersion({ logger });

const REPO_OWNER = 'Ariedam64';
const REPO_NAME = 'MG-AFK';

const fetchLatestRelease = () =>
  new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'MG-AFK',
          Accept: 'application/vnd.github+json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 404) {
            resolve(null);
            return;
          }
          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            reject(new Error(`GitHub ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on('error', reject);
  });

const fetchAssetBuffer = (url, redirectsLeft = 3) =>
  new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          const nextUrl = new URL(res.headers.location, url).toString();
          res.resume();
          resolve(fetchAssetBuffer(nextUrl, redirectsLeft - 1));
          return;
        }

        if (res.statusCode && res.statusCode >= 400) {
          res.resume();
          reject(new Error(`Asset fetch failed (${res.statusCode})`));
          return;
        }

        const encoding = res.headers['content-encoding'] || 'identity';
        let stream = res;
        if (encoding === 'br') {
          stream = res.pipe(zlib.createBrotliDecompress());
        } else if (encoding === 'gzip') {
          stream = res.pipe(zlib.createGunzip());
        } else if (encoding === 'deflate') {
          stream = res.pipe(zlib.createInflate());
        }

        const chunks = [];
        stream.on('data', (chunk) => {
          chunks.push(chunk);
        });
        stream.on('end', () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: res.headers['content-type'] || '',
          });
        });
        stream.on('error', reject);
      },
    );
    req.on('error', reject);
  });

const fetchAssetJson = async (url) => {
  const { buffer } = await fetchAssetBuffer(url);
  return JSON.parse(buffer.toString('utf8'));
};

const normalizeVersion = (value) => String(value || '').trim().replace(/^v/i, '');

const parseVersion = (value) => {
  const cleaned = normalizeVersion(value);
  const match = cleaned.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  const nums = match
    .slice(1)
    .filter(Boolean)
    .map((part) => Number(part));
  while (nums.length < 3) nums.push(0);
  return nums;
};

const compareVersions = (a, b) => {
  for (let i = 0; i < 3; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff > 0) return 1;
    if (diff < 0) return -1;
  }
  return 0;
};

ipcMain.handle('ws:connect', async (event, options) => {
  try {
    const sessionId = resolveSessionId(options?.sessionId);
    const clean = {
      sessionId,
      version: options?.version || 'auto',
      room: options?.room || 'auto',
    };
    emitDebug('info', 'connect request', JSON.stringify(clean), sessionId);
    const versionLogger = (level, message, detail) =>
      emitDebug(level, message, detail, sessionId);
    const version =
      options && options.version
        ? options.version
        : await fetchLatestVersion(versionLogger);
    const client = getClient(sessionId);
    const result = client.connect({
      version,
      room: options?.room,
      cookie: options?.cookie,
      host: options?.host,
      userAgent: options?.userAgent,
      reconnect: options?.reconnect,
    });
    const detail = result.url ? `player=${result.playerId || ''} url=${result.url}` : result.playerId || '';
    emitDebug('info', 'connect ok', detail, sessionId);
    return result;
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    emitDebug('error', 'connect failed', msg, resolveSessionId(options?.sessionId));
    return { error: msg };
  }
});

ipcMain.handle('app:checkUpdate', async () => {
  try {
    const release = await fetchLatestRelease();
    const currentVersion = app.getVersion();
    if (!release) {
      const url = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;
      return {
        status: 'no-release',
        currentVersion,
        latestVersion: '',
        url,
      };
    }
    const latestTag = release?.tag_name || release?.name || '';
    const latestVersion = normalizeVersion(latestTag) || latestTag || currentVersion;
    const url =
      release?.html_url || `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
    const parsedCurrent = parseVersion(currentVersion);
    const parsedLatest = parseVersion(latestTag);

    let available = false;
    if (parsedCurrent && parsedLatest) {
      available = compareVersions(parsedLatest, parsedCurrent) > 0;
    } else {
      available = normalizeVersion(latestVersion) !== normalizeVersion(currentVersion);
    }

    return {
      status: available ? 'available' : 'up-to-date',
      currentVersion,
      latestVersion,
      url,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err && err.message ? err.message : String(err),
    };
  }
});

ipcMain.handle('app:openExternal', async (event, url) => {
  if (!url) return false;
  await shell.openExternal(String(url));
  return true;
});

ipcMain.handle('app:notify', (event, payload) => {
  const title = payload?.title ? String(payload.title) : 'MG AFK';
  const body = payload?.body ? String(payload.body) : '';
  const iconPath = getTrayIconPath();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : undefined;
  if (tray && process.platform === 'win32' && typeof tray.displayBalloon === 'function') {
    tray.displayBalloon({
      title,
      content: body,
      icon: icon || undefined,
    });
  }
  return Boolean(tray);
});

ipcMain.handle('assets:manifest', async () => {
  try {
    return await loadManifest();
  } catch {
    return null;
  }
});

ipcMain.handle('assets:json', async (event, payload) => {
  const relativePath = String(payload?.path || '').trim();
  if (!relativePath) return null;
  const url = await getAssetUrl(relativePath);
  if (!url) return null;
  try {
    return await fetchAssetJson(url);
  } catch {
    return null;
  }
});

ipcMain.handle('assets:image', async (event, payload) => {
  const relativePath = String(payload?.path || '').trim();
  if (!relativePath) return null;
  const url = await getAssetUrl(relativePath);
  if (!url) return null;
  try {
    const { buffer, contentType } = await fetchAssetBuffer(url);
    const mime = String(contentType || 'image/png').split(';')[0] || 'image/png';
    return { dataUrl: `data:${mime};base64,${buffer.toString('base64')}` };
  } catch {
    return null;
  }
});

ipcMain.handle('ws:disconnect', (event, options) => {
  const sessionId = resolveSessionId(options?.sessionId);
  const client = getClient(sessionId);
  emitDebug('info', 'disconnect request', '', sessionId);
  client.disconnect();
  return { ok: true };
});

ipcMain.handle('ws:dispose', (event, options) => {
  const sessionId = resolveSessionId(options?.sessionId);
  const client = clients.get(sessionId);
  if (!client) return { ok: false };
  client.removeAllListeners();
  client.disconnect();
  clients.delete(sessionId);
  emitDebug('info', 'dispose session', '', sessionId);
  return { ok: true };
});

ipcMain.on('tray:session', (event, payload) => {
  const id = resolveSessionId(payload?.id);
  if (payload?.removed) {
    sessionStates.delete(id);
  } else {
    sessionStates.set(id, {
      id,
      name: payload?.name || id,
      connected: Boolean(payload?.connected),
      room: payload?.room || '',
      roomId: payload?.roomId || '',
      gameUrl: payload?.gameUrl || '',
      pets: Array.isArray(payload?.pets) ? payload.pets : [],
    });
  }
  updateTrayMenu();
});

ipcMain.on('tray:active', (event, payload) => {
  const id = resolveSessionId(payload?.sessionId);
  activeSessionId = id;
  updateTrayMenu();
});

ipcMain.on('tray:update-status', (event, payload) => {
  trayUpdateStatus = String(payload?.text || '').trim();
  updateTrayMenu();
});

const createWindow = () => {
  const iconPath = getTrayIconPath();
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 460,
    backgroundColor: '#0c1116',
    title: 'MG AFK',
    icon: iconPath,
    useContentSize: true,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
    updateTrayMenu();
  });
  mainWindow.on('show', () => updateTrayMenu());
  mainWindow.on('hide', () => updateTrayMenu());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(() => {
  app.setAppUserModelId('com.mgafk.app');
  app.setName('MG AFK');
  process.title = 'MG AFK';
  createWindow();
  createTray();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  clients.forEach((client) => client.disconnect());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('window:resize', (event, size) => {
  if (!mainWindow || !size) return;
  const width = Number(size.width);
  const height = Number(size.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;
  const display = screen.getDisplayNearestPoint(mainWindow.getBounds());
  const maxWidth = display?.workAreaSize?.width || width;
  const maxHeight = display?.workAreaSize?.height || height;
  const nextWidth = Math.min(Math.ceil(width), maxWidth);
  const nextHeight = Math.min(Math.ceil(height), maxHeight);
  mainWindow.setContentSize(nextWidth, nextHeight);
});
