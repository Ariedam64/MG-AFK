'use strict';
const path = require('path');
const fs = require('fs');
const { app, shell, Tray, Menu, nativeImage } = require('electron');

const getTrayHintFlagPath = () =>
  path.join(app.getPath('userData'), 'tray-hint-shown');

const hasTrayHintBeenShown = () => {
  try { return fs.existsSync(getTrayHintFlagPath()); } catch { return false; }
};

const markTrayHintShown = () => {
  try { fs.writeFileSync(getTrayHintFlagPath(), '1'); } catch { /* ignore */ }
};

let tray = null;
let trayUpdateStatus = '';
const sessionStates = new Map();
let activeSessionId = '';

let _getMainWindow = null;
let _setIsQuitting = null;
let _sendToRenderer = null;
let _createWindow = null;

const init = ({ getMainWindow, setIsQuitting, sendToRenderer, createWindow }) => {
  _getMainWindow = getMainWindow;
  _setIsQuitting = setIsQuitting;
  _sendToRenderer = sendToRenderer;
  _createWindow = createWindow;
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

const buildRoomUrl = (session) => {
  if (!session) return '';
  const base = String(session.gameUrl || 'https://magicgarden.gg').replace(/\/+$/, '');
  const room = session.roomId || session.room || '';
  return room ? `${base}/r/${room}` : base;
};

const showMainWindow = () => {
  let mainWindow = _getMainWindow();
  if (!mainWindow) {
    _createWindow();
    mainWindow = _getMainWindow();
  }
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
};

const toggleWindow = () => {
  const mainWindow = _getMainWindow();
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showMainWindow();
  }
  updateTrayMenu();
};

const getTraySession = () => {
  if (activeSessionId && sessionStates.has(activeSessionId)) {
    return sessionStates.get(activeSessionId);
  }
  const first = sessionStates.values().next();
  return first.done ? null : first.value;
};

const updateTrayMenu = () => {
  if (!tray) return;
  const mainWindow = _getMainWindow();
  const showLabel = mainWindow && mainWindow.isVisible() ? 'Hide' : 'Show';
  const sessionsMenu = Array.from(sessionStates.values()).map((value) => {
    const petItems = Array.isArray(value.pets) ? value.pets : [];
    const petMenu = petItems.length
      ? petItems.map((pet) => ({ label: formatPetLabel(pet), enabled: false }))
      : [{ label: 'No pets', enabled: false }];
    return {
      label: value.name || value.id,
      submenu: [
        {
          label: value.connected ? 'Disconnect' : 'Connect',
          click: () => _sendToRenderer('tray:toggle-connection', { sessionId: value.id }),
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
    { label: showLabel, click: () => toggleWindow() },
    { label: 'Check update', click: () => _sendToRenderer('tray:check-update', {}) },
    ...(trayUpdateStatus ? [{ label: trayUpdateStatus, enabled: false }] : []),
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
        _setIsQuitting(true);
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

const setSession = (id, data) => {
  if (data?.removed) {
    sessionStates.delete(id);
  } else {
    sessionStates.set(id, {
      id,
      name: data?.name || id,
      connected: Boolean(data?.connected),
      room: data?.room || '',
      roomId: data?.roomId || '',
      gameUrl: data?.gameUrl || '',
      pets: Array.isArray(data?.pets) ? data.pets : [],
    });
  }
  updateTrayMenu();
};

const setActiveSessionId = (id) => {
  activeSessionId = id;
  updateTrayMenu();
};

const setUpdateStatus = (text) => {
  trayUpdateStatus = String(text || '').trim();
  updateTrayMenu();
};

const getTray = () => tray;

const showTrayHint = () => {
  if (!tray || process.platform !== 'win32') return;
  if (hasTrayHintBeenShown()) return;
  markTrayHintShown();
  try {
    const iconPath = getTrayIconPath();
    const icon = iconPath ? nativeImage.createFromPath(iconPath) : undefined;
    tray.displayBalloon({
      title: 'MG AFK continues in the background',
      content: 'The app is still running. Click the tray icon to reopen it, or right-click to quit.',
      icon: icon || undefined,
    });
  } catch { /* ignore */ }
};

module.exports = {
  init,
  createTray,
  updateTrayMenu,
  getTrayIconPath,
  setSession,
  setActiveSessionId,
  setUpdateStatus,
  getTray,
  showTrayHint,
};
