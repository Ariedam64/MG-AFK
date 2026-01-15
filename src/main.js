'use strict';
const path = require('path');
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const { RoomClient } = require('./ws/roomClient');

let mainWindow = null;
const clients = new Map();

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

const fetchLatestVersion = () => {
  const maxRedirects = 4;

  const requestUrl = (url, depth) =>
    new Promise((resolve, reject) => {
      emitDebug('info', 'version fetch', url);
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
          const status = res.statusCode || 0;
          const encoding = res.headers['content-encoding'] || 'identity';
          emitDebug('info', 'version fetch status', `${status} ${encoding}`);

          if (status >= 300 && status < 400 && res.headers.location) {
            if (depth >= maxRedirects) {
              res.resume();
              reject(new Error('Too many redirects'));
              return;
            }
            const nextUrl = new URL(res.headers.location, url).toString();
            emitDebug('info', 'version redirect', nextUrl);
            res.resume();
            resolve(requestUrl(nextUrl, depth + 1));
            return;
          }

          if (status >= 400) {
            res.resume();
            emitDebug('error', 'version fetch status', String(status));
            reject(new Error(`Version fetch failed (${status})`));
            return;
          }

          let stream = res;
          if (encoding === 'br') {
            stream = res.pipe(zlib.createBrotliDecompress());
          } else if (encoding === 'gzip') {
            stream = res.pipe(zlib.createGunzip());
          } else if (encoding === 'deflate') {
            stream = res.pipe(zlib.createInflate());
          }

          let data = '';
          stream.setEncoding('utf8');
          stream.on('data', (chunk) => {
            data += chunk;
          });
          stream.on('end', () => {
            emitDebug('info', 'version fetch bytes', String(data.length));
            const match = data.match(/\/version\/([^/]+)\//);
            if (!match || !match[1]) {
              const snippet = data.slice(0, 800);
              emitDebug(
                'error',
                'version match failed',
                snippet.replace(/\s+/g, ' ').slice(0, 200),
              );
              reject(new Error('Version not found'));
              return;
            }
            emitDebug('info', 'version found', match[1]);
            resolve(match[1]);
          });
          stream.on('error', (err) => {
            emitDebug('error', 'version decode error', err.message || String(err));
            reject(err);
          });
        },
      );

      req.on('error', (err) => {
        emitDebug('error', 'version fetch error', err.message || String(err));
        reject(err);
      });
      req.setTimeout(8000, () => {
        req.destroy(new Error('Version fetch timeout'));
      });
    });

  return requestUrl('https://magicgarden.gg', 0);
};

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
    const version =
      options && options.version ? options.version : await fetchLatestVersion();
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

ipcMain.handle('ws:disconnect', (event, options) => {
  const sessionId = resolveSessionId(options?.sessionId);
  const client = getClient(sessionId);
  emitDebug('info', 'disconnect request', '', sessionId);
  client.disconnect();
  return { ok: true };
});

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 460,
    backgroundColor: '#0c1116',
    title: 'MG AFK',
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
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
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
