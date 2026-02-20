'use strict';
const { ipcMain, shell, screen, nativeImage } = require('electron');
const { fetchGameVersion } = require('../assets/gameVersion');
const { getAssetUrl } = require('../assets/assets');
const { loadManifest } = require('../assets/manifest');
const { getClient, resolveSessionId, disposeClient } = require('./clients');
const { getTrayIconPath, setSession, setActiveSessionId, setUpdateStatus } = require('./tray');
const {
  fetchAssetBuffer,
  fetchAssetJson,
  fetchLatestRelease,
  normalizeVersion,
  parseVersion,
  compareVersions,
  REPO_OWNER,
  REPO_NAME,
} = require('./fetch');

const register = ({ getMainWindow, emitDebug, getTray }) => {
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
          : await fetchGameVersion({ logger: versionLogger });
      const client = getClient(sessionId);
      const result = client.connect({
        version,
        room: options?.room,
        cookie: options?.cookie,
        host: options?.host,
        userAgent: options?.userAgent,
        reconnect: options?.reconnect,
      });
      const detail = result.url
        ? `player=${result.playerId || ''} url=${result.url}`
        : result.playerId || '';
      emitDebug('info', 'connect ok', detail, sessionId);
      return result;
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      emitDebug('error', 'connect failed', msg, resolveSessionId(options?.sessionId));
      return { error: msg };
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
    const ok = disposeClient(sessionId);
    if (ok) emitDebug('info', 'dispose session', '', sessionId);
    return { ok };
  });

  ipcMain.handle('app:checkUpdate', async () => {
    try {
      const { app } = require('electron');
      const release = await fetchLatestRelease();
      const currentVersion = app.getVersion();
      if (!release) {
        return {
          status: 'no-release',
          currentVersion,
          latestVersion: '',
          url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`,
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
      return { status: available ? 'available' : 'up-to-date', currentVersion, latestVersion, url };
    } catch (err) {
      return { status: 'error', message: err && err.message ? err.message : String(err) };
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
    const tray = getTray();
    if (tray && process.platform === 'win32' && typeof tray.displayBalloon === 'function') {
      tray.displayBalloon({ title, content: body, icon: icon || undefined });
    }
    return Boolean(tray);
  });

  ipcMain.handle('assets:manifest', async () => {
    try { return await loadManifest(); } catch { return null; }
  });

  ipcMain.handle('assets:json', async (event, payload) => {
    const relativePath = String(payload?.path || '').trim();
    if (!relativePath) return null;
    const url = await getAssetUrl(relativePath);
    if (!url) return null;
    try { return await fetchAssetJson(url); } catch { return null; }
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
    } catch { return null; }
  });

  ipcMain.on('tray:session', (event, payload) => {
    const id = resolveSessionId(payload?.id);
    setSession(id, payload);
  });

  ipcMain.on('tray:active', (event, payload) => {
    const id = resolveSessionId(payload?.sessionId);
    setActiveSessionId(id);
  });

  ipcMain.on('tray:update-status', (event, payload) => {
    setUpdateStatus(payload?.text);
  });

  ipcMain.on('window:resize', (event, size) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || !size) return;
    const width = Number(size.width);
    const height = Number(size.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    const display = screen.getDisplayNearestPoint(mainWindow.getBounds());
    const maxWidth = display?.workAreaSize?.width || width;
    const maxHeight = display?.workAreaSize?.height || height;
    mainWindow.setContentSize(
      Math.min(Math.ceil(width), maxWidth),
      Math.min(Math.ceil(height), maxHeight),
    );
  });
};

module.exports = { register };
