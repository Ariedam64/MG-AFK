'use strict';
const { RoomClient } = require('../ws/roomClient');

const clients = new Map();

const resolveSessionId = (value) => {
  const text = String(value || '').trim();
  return text || 'default';
};

const bindClient = (client, sessionId, { sendToRenderer, emitDebug }) => {
  client.on('status', (payload) => {
    sendToRenderer('ws:status', { sessionId, ...payload });
    if (!payload || !payload.state) return;
    if (payload.state === 'error') {
      emitDebug('error', 'ws error', payload.message || payload.reason || 'unknown', sessionId);
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
    emitDebug(payload.level || 'info', payload.message || 'debug', payload.detail || '', sessionId);
  });
  client.on('gameAction', (payload) => {
    if (!payload) return;
    const detail = payload.gameName ? `${payload.type} | ${payload.gameName}` : payload.type;
    emitDebug('info', 'game action', detail, sessionId);
  });
};

let _helpers = null;

const init = (helpers) => {
  _helpers = helpers;
};

const getClient = (sessionId) => {
  const key = resolveSessionId(sessionId);
  if (clients.has(key)) return clients.get(key);
  const client = new RoomClient();
  bindClient(client, key, _helpers);
  clients.set(key, client);
  return client;
};

const disposeClient = (sessionId) => {
  const key = resolveSessionId(sessionId);
  const client = clients.get(key);
  if (!client) return false;
  client.removeAllListeners();
  client.disconnect();
  clients.delete(key);
  return true;
};

const disconnectAll = () => {
  clients.forEach((client) => client.disconnect());
};

module.exports = { init, resolveSessionId, getClient, disposeClient, disconnectAll };
