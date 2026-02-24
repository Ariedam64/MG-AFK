'use strict';
const { ipcMain, shell, screen, nativeImage } = require('electron');

const AUTH_PARTITION = 'persist:mgafk-auth';
let authWin = null;
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

  ipcMain.handle('auth:clearToken', async () => {
    const { session } = require('electron');
    const ses = session.fromPartition(AUTH_PARTITION);
    const cookies = await ses.cookies.get({ name: 'mc_jwt' });
    for (const c of cookies) {
      const url = `https://${c.domain.replace(/^\./, '')}`;
      await ses.cookies.remove(url, 'mc_jwt').catch(() => {});
    }
    return { ok: true };
  });

  // Check for an existing mc_jwt in the persistent auth session.
  // If none found, pre-load the game page in a hidden window so Login is instant.
  ipcMain.handle('auth:check', async () => {
    const { session, BrowserWindow } = require('electron');
    const ses = session.fromPartition(AUTH_PARTITION);
    const cookies = await ses.cookies.get({ name: 'mc_jwt' });
    const found = cookies.find((c) => c.value);
    if (found) return { token: `mc_jwt=${found.value}` };

    // No token — pre-load the login page and pre-click "Sign In" in background
    // so the Discord modal is already open when the user hits Login.
    if (!authWin || authWin.isDestroyed()) {
      authWin = new BrowserWindow({
        width: 600,
        height: 760,
        title: 'MG — Login',
        autoHideMenuBar: true,
        show: false,
        webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true },
      });
      authWin.loadURL('https://magicgarden.gg', { userAgent: 'McDesktopClient' });

      // After load, poll for "Sign In" and click it so the Discord modal is pre-opened.
      authWin.webContents.once('did-finish-load', () => {
        const tryPreClick = (attempts = 0) => {
          if (!authWin || authWin.isDestroyed()) return;
          authWin.webContents
            .executeJavaScript(`
              (() => {
                const btn = [...document.querySelectorAll('button.chakra-button')]
                  .find(el => el.textContent.trim() === 'Sign In');
                if (btn) { btn.click(); return true; }
                return false;
              })()
            `)
            .then((clicked) => {
              if (!clicked && attempts < 20 && authWin && !authWin.isDestroyed()) {
                setTimeout(() => tryPreClick(attempts + 1), 250);
              }
            })
            .catch(() => {});
        };
        tryPreClick();
      });
    }
    return { token: null };
  });

  // Show the pre-loaded login window, auto-clicking the Discord button so the
  // user lands directly on the Discord OAuth page instead of the game's login page.
  // Uses a persistent session so the cookie survives app restarts.
  ipcMain.handle('auth:login', () => {
    const { session, BrowserWindow } = require('electron');
    const ses = session.fromPartition(AUTH_PARTITION);
    return new Promise((resolve) => {
      if (!authWin || authWin.isDestroyed()) {
        authWin = new BrowserWindow({
          width: 600,
          height: 760,
          title: 'MG — Login',
          autoHideMenuBar: true,
          show: false,
          webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true },
        });
      }

      const win = authWin;
      let done = false;

      const finish = (token) => {
        if (done) return;
        done = true;
        ses.cookies.off('changed', onChanged);
        win.removeListener('closed', onClosed);
        if (!win.isDestroyed()) win.hide();
        resolve({ token: token || null });
      };

      const onChanged = (_evt, cookie, _cause, removed) => {
        if (removed || cookie.name !== 'mc_jwt' || !cookie.value) return;
        finish(`mc_jwt=${cookie.value}`);
      };

      const onClosed = () => finish(null);

      ses.cookies.on('changed', onChanged);
      win.once('closed', onClosed);

      // Two-step flow (React hydrates after did-finish-load):
      //   1. Poll for "Sign In" button → click it
      //   2. Poll for "Sign in with Discord" button → click it → show window
      const clickDiscordAndShow = () => {
        const MAX = 20;

        const pollClick = (script, onSuccess, onTimeout) => {
          let attempts = 0;
          const tryClick = () => {
            if (done || win.isDestroyed()) return;
            win.webContents
              .executeJavaScript(script)
              .then((clicked) => {
                if (done || win.isDestroyed()) return;
                if (clicked) onSuccess();
                else if (++attempts < MAX) setTimeout(tryClick, 250);
                else onTimeout();
              })
              .catch(() => { if (!win.isDestroyed() && !done) win.show(); });
          };
          tryClick();
        };

        // Step 2 — click "Sign in with Discord" then reveal the window.
        const clickDiscord = () => pollClick(
          `(() => {
            const btn = [...document.querySelectorAll('button.chakra-button')]
              .find(el => el.textContent.includes('Discord'));
            if (btn) { btn.click(); return true; }
            return false;
          })()`,
          () => { setTimeout(() => { if (!win.isDestroyed() && !done) win.show(); }, 300); },
          () => { if (!win.isDestroyed() && !done) win.show(); },
        );

        // Step 1 — if Discord modal not already open (pre-clicked at startup), click "Sign In".
        win.webContents
          .executeJavaScript(`
            (() => [...document.querySelectorAll('button.chakra-button')]
              .some(el => el.textContent.includes('Discord')))()
          `)
          .then((discordVisible) => {
            if (done || win.isDestroyed()) return;
            if (discordVisible) {
              clickDiscord();
            } else {
              pollClick(
                `(() => {
                  const btn = [...document.querySelectorAll('button.chakra-button')]
                    .find(el => el.textContent.trim() === 'Sign In');
                  if (btn) { btn.click(); return true; }
                  return false;
                })()`,
                () => { setTimeout(clickDiscord, 300); },
                () => { if (!win.isDestroyed() && !done) win.show(); },
              );
            }
          })
          .catch(() => { if (!win.isDestroyed() && !done) win.show(); });
      };

      const url = win.webContents.getURL();
      const notLoaded = !url || url === 'about:blank';

      if (notLoaded) {
        win.webContents.once('did-finish-load', clickDiscordAndShow);
        win.loadURL('https://magicgarden.gg', { userAgent: 'McDesktopClient' });
      } else if (win.webContents.isLoading()) {
        win.webContents.once('did-finish-load', clickDiscordAndShow);
      } else {
        clickDiscordAndShow();
      }
    });
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
