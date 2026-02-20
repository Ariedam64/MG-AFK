'use strict';

const { TEXT_MS, APP_MS, GAME_NAME } = require('./constants');
const { fmtDate } = require('./format');
const { applyPatch } = require('./patch');
const {
  findUserSlotIndex,
  pickRoomState,
  pickGameState,
  slimPlayer,
  slimUserSlot,
  slimUserSlotData,
  slimShop,
  slimShops,
} = require('./state');
const { isAbilityName } = require('./pets');

const onOpen = (client) => {
  client._send({ scopePath: ['Room'], type: 'VoteForGame', gameName: GAME_NAME });
  client._send({ scopePath: ['Room'], type: 'SetSelectedGame', gameName: GAME_NAME });

  client.textPing = setInterval(() => {
    client._send('ping');
  }, TEXT_MS);
  client.textPing.unref?.();

  client.appPing = setInterval(() => {
    client._send({
      scopePath: ['Room', GAME_NAME],
      type: 'Ping',
      id: Date.now(),
    });
  }, APP_MS);
  client.appPing.unref?.();
};

const onMessage = (client, data) => {
  const raw = String(data);
  client.emit('traffic', { direction: 'in', text: raw, ts: Date.now() });
  if (raw === 'ping' || raw === '"ping"' || raw === "'ping'") {
    client._send('pong');
    return;
  }

  let msg;
  try {
    msg = JSON.parse(raw);
  } catch (err) {
    return;
  }

  if (msg.type === 'Welcome' && msg.fullState) {
    const room = msg.fullState?.data || null;
    const game = msg.fullState?.child?.data || null;
    const me = room?.players?.find((p) => p?.id === client.playerId);
    if (me && me.databaseUserId == null) {
      client._failAuth('Invalid mc_jwt cookie.');
      return;
    }
    client.roomState = room ? pickRoomState(room) : null;
    client.gameState = game ? pickGameState(game) : null;
    client._emitPlayerCount(client.roomState);
    client._emitLiveStatus();
    client._emitShops();
    if (!client.welcomed) {
      client.welcomed = true;
      client.connectedAt = Date.now();
      client.state = 'connected';
      client.retryCount = 0;
      client.retryCode = null;
      client.hasEverWelcomed = true;
      client.initialConnectFastRetry = false;
      client._clearRetryTimers();
      client.emit('status', {
        state: 'connected',
        room: client.room,
        version: client.version,
        playerId: client.playerId,
        connectedAt: client.connectedAt,
      });
      client._startTicker();
    }
    return;
  }

  if (msg.type !== 'PartialState' || !Array.isArray(msg.patches)) return;

  const logs = new Map();
  let roomDirty = false;
  let seen = 0;
  let liveDirty = false;
  let shopsDirty = false;
  const userSlotEntryRe = /^\/child\/data\/userSlots\/\d+$/;
  const userSlotDataRe = /^\/child\/data\/userSlots\/\d+\/data$/;
  const userSlotAllowedRe =
    /^\/child\/data\/userSlots\/\d+\/(playerId|data\/(playerId|databaseUserId|userId|id|petSlots|activityLogs))(?:\/|$)/;
  const playerEntryRe = /^\/data\/players\/\d+$/;
  const playerFieldRe =
    /^\/data\/players\/\d+\/(id|name|isConnected|databaseUserId)(?:\/|$)/;
  const roomFieldRe = /^\/data\/(roomId|roomSessionId|hostPlayerId)(?:$|\/)/;
  const shopEntryRe = /^\/child\/data\/shops\/(seed|tool|egg|decor)$/;

  for (const p of msg.patches) {
    if (!p || typeof p.path !== 'string') continue;

    if (client.roomState) {
      if (playerEntryRe.test(p.path)) {
        applyPatch(client.roomState, p.path, slimPlayer(p.value), p.op);
        roomDirty = true;
        continue;
      }
      if (playerFieldRe.test(p.path) || roomFieldRe.test(p.path)) {
        applyPatch(client.roomState, p.path, p.value, p.op);
        roomDirty = true;
        continue;
      }
    }

    if (client.gameState) {
      if (p.path === '/child/data/weather') {
        applyPatch(client.gameState, p.path.replace(/^\/child/, ''), p.value, p.op);
        liveDirty = true;
        continue;
      }
      if (userSlotEntryRe.test(p.path)) {
        applyPatch(client.gameState, p.path.replace(/^\/child/, ''), slimUserSlot(p.value), p.op);
        liveDirty = true;
        continue;
      }
      if (userSlotDataRe.test(p.path)) {
        applyPatch(
          client.gameState,
          p.path.replace(/^\/child/, ''),
          slimUserSlotData(p.value),
          p.op,
        );
        liveDirty = true;
        continue;
      }
      if (userSlotAllowedRe.test(p.path)) {
        applyPatch(client.gameState, p.path.replace(/^\/child/, ''), p.value, p.op);
        liveDirty = true;
        continue;
      }
      if (p.path === '/child/data/shops') {
        applyPatch(client.gameState, p.path.replace(/^\/child/, ''), slimShops(p.value), p.op);
        shopsDirty = true;
        continue;
      }
      if (shopEntryRe.test(p.path)) {
        applyPatch(
          client.gameState,
          p.path.replace(/^\/child/, ''),
          slimShop(p.value),
          p.op,
        );
        shopsDirty = true;
        continue;
      }
      if (p.path.startsWith('/child/data/shops/')) {
        applyPatch(client.gameState, p.path.replace(/^\/child/, ''), p.value, p.op);
        shopsDirty = true;
      }
    }
  }

  if (client.roomState) {
    const players = Array.isArray(client.roomState.players) ? client.roomState.players : [];
    const idx = players.findIndex((p) => p?.id === client.playerId);
    if (idx >= 0) client.playerIndex = idx;
    const slotIndex = findUserSlotIndex(
      client.roomState,
      client.gameState,
      client.playerId,
      client.playerIndex,
    );
    if (slotIndex != null) {
      client.userSlotIndex = slotIndex;
    }
  }

  for (const p of msg.patches) {
    if (!p || typeof p.path !== 'string') continue;

    const m =
      p.path.match(
        /\/child\/data\/userSlots\/(\d+)\/data\/activityLogs\/(\d+)\/(action|timestamp)(?:$|\/)/,
      ) ||
      p.path.match(/\/data\/activityLogs\/(\d+)\/(action|timestamp)(?:$|\/)/);
    if (m) {
      const slotIndex = m.length === 4 ? Number(m[1]) : null;
      const idx = m.length === 4 ? Number(m[2]) : Number(m[1]);
      const key = m.length === 4 ? m[3] : m[2];
      if (client.userSlotIndex != null && slotIndex == null) continue;
      if (client.userSlotIndex != null && slotIndex !== client.userSlotIndex) continue;
      const cur = logs.get(idx) || { idx, seen: 0 };
      if (key === 'action') cur.action = p.value;
      if (key === 'timestamp') cur.ts = p.value;
      if (slotIndex != null) cur.slotIndex = slotIndex;
      cur.seen = ++seen;
      logs.set(idx, cur);
      continue;
    }

    const mp =
      p.path.match(
        /\/child\/data\/userSlots\/(\d+)\/data\/activityLogs\/(\d+)\/parameters\/pet\/name$/,
      ) || p.path.match(/\/data\/activityLogs\/(\d+)\/parameters\/pet\/name$/);
    if (mp) {
      const slotIndex = mp.length === 3 ? Number(mp[1]) : null;
      const idx = mp.length === 3 ? Number(mp[2]) : Number(mp[1]);
      if (client.userSlotIndex != null && slotIndex == null) continue;
      if (client.userSlotIndex != null && slotIndex !== client.userSlotIndex) continue;
      const cur = logs.get(idx) || { idx, seen: 0 };
      cur.petName = p.value;
      if (slotIndex != null) cur.slotIndex = slotIndex;
      cur.seen = ++seen;
      logs.set(idx, cur);
      continue;
    }

    const ms =
      p.path.match(
        /\/child\/data\/userSlots\/(\d+)\/data\/activityLogs\/(\d+)\/parameters\/pet\/petSpecies$/,
      ) || p.path.match(/\/data\/activityLogs\/(\d+)\/parameters\/pet\/petSpecies$/);
    if (ms) {
      const slotIndex = ms.length === 3 ? Number(ms[1]) : null;
      const idx = ms.length === 3 ? Number(ms[2]) : Number(ms[1]);
      if (client.userSlotIndex != null && slotIndex == null) continue;
      if (client.userSlotIndex != null && slotIndex !== client.userSlotIndex) continue;
      const cur = logs.get(idx) || { idx, seen: 0 };
      cur.petSpecies = p.value;
      if (slotIndex != null) cur.slotIndex = slotIndex;
      cur.seen = ++seen;
      logs.set(idx, cur);
    }
  }

  if (client.roomState) client._emitPlayerCount(client.roomState);
  if (roomDirty || liveDirty) {
    client._emitLiveStatus();
  }
  if (shopsDirty) {
    client._emitShops();
  }

  const activityLogs =
    client.userSlotIndex != null
      ? client.gameState?.userSlots?.[client.userSlotIndex]?.data?.activityLogs
      : null;
  if (Array.isArray(activityLogs)) {
    for (const entry of logs.values()) {
      const fromState = activityLogs[entry.idx];
      if (!fromState) continue;
      if (!entry.action && fromState.action) entry.action = fromState.action;
      if (!entry.ts && fromState.timestamp) entry.ts = fromState.timestamp;
      const pet = fromState.parameters?.pet;
      if (pet) {
        if (entry.petName == null && pet.name != null) entry.petName = pet.name;
        if (entry.petSpecies == null && pet.petSpecies != null) {
          entry.petSpecies = pet.petSpecies;
        }
      }
    }
  }

  let best = null;
  for (const entry of logs.values()) {
    if (!isAbilityName(entry.action)) continue;
    if (!best) {
      best = entry;
      continue;
    }
    if (entry.ts && best.ts) {
      if (entry.ts > best.ts) best = entry;
      continue;
    }
    if (entry.ts && !best.ts) {
      best = entry;
      continue;
    }
    if (!entry.ts && best.ts) continue;
    if (entry.idx > best.idx) {
      best = entry;
      continue;
    }
    if (entry.seen > best.seen) best = entry;
  }

  if (best) {
    let petMutations = null;
    if (Array.isArray(activityLogs) && activityLogs[best.idx]) {
      const pet = activityLogs[best.idx]?.parameters?.pet;
      if (pet) {
        if (best.petName == null && pet.name != null) best.petName = pet.name;
        if (best.petSpecies == null && pet.petSpecies != null) {
          best.petSpecies = pet.petSpecies;
        }
        if (Array.isArray(pet.mutations)) {
          const cleaned = pet.mutations.filter(Boolean);
          if (cleaned.length) petMutations = cleaned;
        }
      }
    }
    const when = fmtDate(Date.now());
    client.emit('abilityLog', {
      when,
      action: best.action,
      petName: best.petName,
      petSpecies: best.petSpecies,
      petMutations,
      slotIndex:
        Number.isFinite(best.slotIndex) ? best.slotIndex : client.userSlotIndex,
    });
  }
};

const onClose = (client, code, reason) => {
  client._clearTimers();
  client.state = 'disconnected';
  client.connectedAt = 0;
  client.welcomed = false;
  client.ws = null;
  const reasonText = Buffer.isBuffer(reason)
    ? reason.toString('utf8')
    : reason
      ? String(reason)
      : '';
  const info = { code, reason: reasonText };
  const closeDetail = [
    Number.isFinite(code) ? `code=${code}` : '',
    reasonText ? `reason=${reasonText}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  client.emit('debug', {
    level: 'info',
    message: 'ws closed',
    detail: closeDetail,
  });
  if (!client.manualClose) {
    const should = client._shouldReconnect(code);
    if (!should) {
      client.emit('debug', {
        level: 'info',
        message: 'reconnect skipped',
        detail: `code=${code} not enabled in reconnect config`,
      });
      client.emit('status', { state: 'disconnected', ...info });
      return;
    }
    const scheduled = client._scheduleReconnect(code, reasonText);
    if (scheduled) return;
    client.emit('debug', {
      level: 'warn',
      message: 'reconnect exhausted',
      detail: `code=${code} retry=${client.retryCount}/${client._getMaxRetries(code)}`,
    });
    client.emit('status', { state: 'disconnected', ...info });
    return;
  }
  if (client.manualClose || code === 1000 || code === 1001) {
    client.emit('status', { state: 'disconnected', ...info });
    return;
  }
  client.emit('status', {
    state: 'error',
    message: reasonText ? `Disconnected (${code}): ${reasonText}` : `Disconnected (${code})`,
    ...info,
  });
};

const onError = (client, err) => {
  client.emit('status', {
    state: 'error',
    message: err && err.message ? err.message : String(err),
  });
};

module.exports = {
  onOpen,
  onMessage,
  onClose,
  onError,
};
