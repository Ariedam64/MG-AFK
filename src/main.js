'use strict';
const path = require('path');
const { app, BrowserWindow } = require('electron');
const tray = require('./main/tray');
const clients = require('./main/clients');
const ipc = require('./main/ipc');

let mainWindow = null;
let isQuitting = false;

const getMainWindow = () => mainWindow;
const setIsQuitting = (value) => { isQuitting = value; };

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
  console.log(`[${fmtTime(ts)}] [${level}] ${message}${fullDetail ? ` | ${fullDetail}` : ''}`);
  sendToRenderer('ws:debug', { level, message, detail: fullDetail, ts, sessionId });
};

const createWindow = () => {
  const iconPath = tray.getTrayIconPath();
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
    tray.updateTrayMenu();
    tray.showTrayHint();
  });
  mainWindow.on('show', () => tray.updateTrayMenu());
  mainWindow.on('hide', () => tray.updateTrayMenu());
  mainWindow.on('closed', () => { mainWindow = null; });
};

// --- Init modules ---
tray.init({ getMainWindow, setIsQuitting, sendToRenderer, createWindow });
clients.init({ sendToRenderer, emitDebug });
ipc.register({ getMainWindow, emitDebug, getTray: tray.getTray });

// --- App lifecycle ---
app.whenReady().then(() => {
  app.setAppUserModelId('com.mgafk.app');
  app.setName('MG AFK');
  process.title = 'MG AFK';
  createWindow();
  tray.createTray();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  clients.disconnectAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
