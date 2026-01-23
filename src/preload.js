'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (handler) => {
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('api', {
  connect: (options) => ipcRenderer.invoke('ws:connect', options),
  disconnect: (options) => ipcRenderer.invoke('ws:disconnect', options),
  dispose: (options) => ipcRenderer.invoke('ws:dispose', options),
  setTraySession: (payload) => ipcRenderer.send('tray:session', payload),
  setActiveSession: (payload) => ipcRenderer.send('tray:active', payload),
  setTrayUpdateStatus: (payload) => ipcRenderer.send('tray:update-status', payload),
  onStatus: on('ws:status'),
  onPlayers: on('ws:players'),
  onUptime: on('ws:uptime'),
  onAbilityLog: on('ws:abilityLog'),
  onDebug: on('ws:debug'),
  resizeTo: (size) => ipcRenderer.send('window:resize', size),
  onTraffic: on('ws:traffic'),
  onLiveStatus: on('ws:liveStatus'),
  onShops: on('ws:shops'),
  onTrayToggle: on('tray:toggle-connection'),
  onTraySelectSession: on('tray:select-session'),
  onTrayCheckUpdate: on('tray:check-update'),
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  notify: (payload) => ipcRenderer.invoke('app:notify', payload),
  assetsManifest: () => ipcRenderer.invoke('assets:manifest'),
  assetsJson: (path) => ipcRenderer.invoke('assets:json', { path }),
  assetsImage: (path) => ipcRenderer.invoke('assets:image', { path }),
});
