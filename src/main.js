'use strict';
const path = require('path');
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const { RoomClient } = require('./ws/roomClient');

let mainWindow = null;
const client = new RoomClient();

const sendToRenderer = (channel, payload) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, payload);
  }
};

const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString('fr-FR', { hour12: false });

const emitDebug = (level, message, detail) => {
  const ts = Date.now();
  const line = `[${fmtTime(ts)}] [${level}] ${message}${
    detail ? ` | ${detail}` : ''
  }`;
  console.log(line);
  sendToRenderer('ws:debug', { level, message, detail, ts });
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

client.on('status', (payload) => {
  sendToRenderer('ws:status', payload);
  if (!payload || !payload.state) return;
  if (payload.state === 'error') {
    const detail = payload.message || payload.reason || 'unknown';
    emitDebug('error', 'ws error', detail);
    return;
  }
  if (payload.state === 'disconnected') {
    const detail = payload.reason
      ? `${payload.code || ''} ${payload.reason}`.trim()
      : String(payload.code || '');
    emitDebug('info', 'ws disconnected', detail);
    return;
  }
  emitDebug('info', 'ws status', payload.state);
});

client.on('players', (payload) => {
  sendToRenderer('ws:players', payload);
  if (payload && typeof payload.count === 'number') {
    emitDebug('info', 'players update', String(payload.count));
  }
});

client.on('uptime', (payload) => sendToRenderer('ws:uptime', payload));
client.on('abilityLog', (payload) => sendToRenderer('ws:abilityLog', payload));
client.on('traffic', (payload) => sendToRenderer('ws:traffic', payload));
client.on('liveStatus', (payload) => sendToRenderer('ws:liveStatus', payload));
client.on('shops', (payload) => sendToRenderer('ws:shops', payload));
client.on('gameAction', (payload) => {
  if (!payload) return;
  const detail = payload.gameName ? `${payload.type} | ${payload.gameName}` : payload.type;
  emitDebug('info', 'game action', detail);
});

ipcMain.handle('ws:connect', async (event, options) => {
  try {
    const clean = {
      version: options?.version || 'auto',
      room: 'auto',
    };
    emitDebug('info', 'connect request', JSON.stringify(clean));
    const version =
      options && options.version ? options.version : await fetchLatestVersion();
    const result = client.connect({
      version,
      cookie: options?.cookie,
      host: options?.host,
      userAgent: options?.userAgent,
      reconnect: options?.reconnect,
    });
    const detail = result.url ? `player=${result.playerId || ''} url=${result.url}` : result.playerId || '';
    emitDebug('info', 'connect ok', detail);
    return result;
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    emitDebug('error', 'connect failed', msg);
    return { error: msg };
  }
});

ipcMain.handle('ws:disconnect', () => {
  emitDebug('info', 'disconnect request', '');
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
  client.disconnect();
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
