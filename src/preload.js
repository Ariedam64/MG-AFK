'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (handler) => {
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('api', {
  connect: (options) => ipcRenderer.invoke('ws:connect', options),
  disconnect: () => ipcRenderer.invoke('ws:disconnect'),
  onStatus: on('ws:status'),
  onPlayers: on('ws:players'),
  onUptime: on('ws:uptime'),
  onAbilityLog: on('ws:abilityLog'),
  resizeTo: (size) => ipcRenderer.send('window:resize', size),
  onTraffic: on('ws:traffic'),
  onLiveStatus: on('ws:liveStatus'),
  onShops: on('ws:shops'),
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
});
