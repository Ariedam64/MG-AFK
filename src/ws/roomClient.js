'use strict';
const EventEmitter = require('events');
const crypto = require('crypto');
const WS = require('ws');

const DEFAULT_HOST = 'magicgarden.gg';
const DEFAULT_VERSION = 'db34dc9';
const TEXT_MS = 2000;
const APP_MS = 2000;
const GAME_NAME = 'Quinoa';
const DEFAULT_UA = 'Mozilla/5.0';
const RETRY_MAX = 3;
const RETRY_DELAY_MS = 1500;
const KNOWN_CLOSE_CODES = new Set([
  4100, 4200, 4250, 4300, 4310, 4400, 4500, 4700, 4710, 4800,
]);
const RECONNECT_DELAY_GROUPS = {
  superseded: new Set([4250, 4300]),
};

const pad = (n) => String(n).padStart(2, '0');
const fmtDuration = (ms) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(ss)}`;
};

const fmtDate = (ms) =>
  new Date(ms).toLocaleString('fr-FR', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const generatePlayerId = () => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.randomBytes(16);
  let id = '';
  for (const b of bytes) {
    id += alphabet[b % alphabet.length];
  }
  return `p_${id}`;
};

const generateRoomId = () => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.randomBytes(10);
  let id = '';
  for (const b of bytes) {
    id += alphabet[b % alphabet.length];
  }
  return id;
};

const normalizeCookie = (cookie) => {
  const trimmed = String(cookie || '').trim();
  if (!trimmed) return '';
  if (/mc_jwt\s*=/.test(trimmed)) return trimmed;
  return `mc_jwt=${trimmed}`;
};

const buildUrl = ({ host, version, room, playerId }) => {
  const u = new URL(`wss://${host}/version/${version}/api/rooms/${room}/connect`);
  u.searchParams.set('surface', '"web"');
  u.searchParams.set('platform', '"desktop"');
  u.searchParams.set('playerId', JSON.stringify(playerId));
  u.searchParams.set('version', JSON.stringify(version));
  u.searchParams.set('source', '"manualUrl"');
  u.searchParams.set('capabilities', '"fbo_mipmap_ok"');
  return u.toString();
};

const decodePointer = (path) =>
  path
    .split('/')
    .slice(1)
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));

const isNumeric = (v) => String(v).match(/^\d+$/);

const applyPatch = (target, path, value, op) => {
  if (!target || typeof path !== 'string') return;
  const segs = decodePointer(path);
  if (!segs.length) return;

  let idx = 0;
  if (segs[0] === 'data') idx = 1;

  let cur = target;
  for (let i = idx; i < segs.length - 1; i += 1) {
    const key = segs[i];
    if (cur[key] == null || typeof cur[key] !== 'object') {
      const next = segs[i + 1];
      cur[key] = isNumeric(next) ? [] : {};
    }
    cur = cur[key];
  }

  const last = segs[segs.length - 1];
  if (op === 'remove') {
    if (Array.isArray(cur)) {
      const n = Number(last);
      if (!Number.isNaN(n)) cur.splice(n, 1);
    } else {
      delete cur[last];
    }
    return;
  }

  cur[last] = value;
};

const BLOCKED_ABILITIES = new Set(['dawnkisser', 'moonkisser']);
const isAbilityName = (x) => {
  if (typeof x !== 'string') return false;
  const name = x.trim();
  if (!name) return false;
  return !BLOCKED_ABILITIES.has(name.toLowerCase());
};

const findUserSlotIndex = (room, game, playerId, playerIndex) => {
  const slots = game?.userSlots;
  if (!Array.isArray(slots)) return null;

  if (typeof playerIndex === 'number' && playerIndex >= 0 && slots[playerIndex]) {
    return playerIndex;
  }

  const byPlayerId = slots.findIndex(
    (slot) =>
      slot &&
      (slot.playerId === playerId ||
        slot?.data?.playerId === playerId ||
        slot?.data?.id === playerId),
  );
  if (byPlayerId >= 0) return byPlayerId;

  const dbId = room?.players?.find((p) => p?.id === playerId)?.databaseUserId;
  if (dbId) {
    const byDb = slots.findIndex(
      (slot) =>
        slot &&
        (slot?.data?.databaseUserId === dbId || slot?.data?.userId === dbId),
    );
    if (byDb >= 0) return byDb;
  }

  return null;
};

const pickUserSlot = (room, game, playerId, playerIndex) => {
  const slots = game?.userSlots;
  if (!Array.isArray(slots)) return null;
  const idx = findUserSlotIndex(room, game, playerId, playerIndex);
  if (idx == null) return null;
  return slots[idx] || null;
};

const extractPets = (slot) => {
  const data = slot?.data || slot;
  const petSlots = data?.petSlots;
  if (!Array.isArray(petSlots)) return [];
  return petSlots
    .map((pet, index) => {
      if (!pet) return null;
      const name = pet.name || '';
      const species = pet.petSpecies || '';
      const hunger = Number.isFinite(pet.hunger) ? Number(pet.hunger) : null;
      return { name, species, hunger, index };
    })
    .filter(Boolean);
};

const extractShopItems = (shop, key) => {
  const inventory = Array.isArray(shop?.inventory) ? shop.inventory : [];
  return inventory
    .filter((item) => item && Number(item.initialStock) > 0)
    .map((item) => ({
      name: item[key],
      stock: item.initialStock,
    }))
    .filter((item) => item.name);
};

class RoomClient extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.state = 'idle';
    this.host = DEFAULT_HOST;
    this.version = DEFAULT_VERSION;
    this.room = '';
    this.playerId = '';
    this.cookie = '';
    this.userAgent = DEFAULT_UA;
    this.roomState = null;
    this.playerCount = 0;
    this.connectedAt = 0;
    this.ticker = null;
    this.textPing = null;
    this.appPing = null;
    this.socketToken = 0;
    this.welcomed = false;
    this.manualClose = false;
    this.gameState = null;
    this.playerIndex = -1;
    this.userSlotIndex = null;
    this.lastLiveKey = '';
    this.lastShopsKey = '';
    this.retryCount = 0;
    this.retryCode = null;
    this.retryTimer = null;
    this.retryCountdownTimer = null;
    this.retryDeadline = 0;
    this.lastConnectOpts = null;
    this.hasEverWelcomed = false;
    this.initialConnectFastRetry = false;
    this.reconnectConfig = {
      unknown: true,
      delays: {
        supersededMs: 30000,
        otherMs: 0,
      },
      codes: {
        4100: true,
        4200: true,
        4250: false,
        4300: false,
        4310: true,
        4400: true,
        4500: true,
        4700: true,
        4710: true,
        4800: true,
      },
    };
  }

  connect({ version, cookie, host, userAgent, reconnect } = {}, meta = {}) {
    const isRetry = Boolean(meta && meta.isRetry);
    const nextVersion = String(version || '').trim();
    const nextCookie = normalizeCookie(cookie);

    if (!nextVersion || !nextCookie) {
      throw new Error('Missing version or cookie');
    }

    if (this.ws) this.disconnect();

    if (!isRetry) {
      this.retryCount = 0;
      this.retryCode = null;
      this.initialConnectFastRetry = !this.hasEverWelcomed;
    }
    this._clearRetryTimers();

    if (reconnect) {
      this._updateReconnectConfig(reconnect);
    }

    this.host = host || DEFAULT_HOST;
    this.version = nextVersion;
    this.room = generateRoomId();
    this.cookie = nextCookie;
    this.userAgent = userAgent || DEFAULT_UA;
    this.playerId = generatePlayerId();
    this.roomState = null;
    this.playerCount = 0;
    this.connectedAt = 0;
    this.welcomed = false;
    this.manualClose = false;
    this.gameState = null;
    this.playerIndex = -1;
    this.userSlotIndex = null;
    this.lastLiveKey = '';
    this.lastShopsKey = '';
    if (!isRetry) {
      this.initialConnectFastRetry = !this.hasEverWelcomed;
    }
    this.lastConnectOpts = {
      version: this.version,
      cookie: this.cookie,
      host: this.host,
      userAgent: this.userAgent,
      reconnect: this.reconnectConfig,
    };

    const url = buildUrl({
      host: this.host,
      version: this.version,
      room: this.room,
      playerId: this.playerId,
    });

    this.state = 'reconnecting';
    this.emit('status', { state: 'connecting' });

    const ws = new WS(url, {
      origin: `https://${this.host}`,
      headers: { 'User-Agent': this.userAgent, Cookie: this.cookie },
      perMessageDeflate: { clientMaxWindowBits: 15 },
    });

    const token = ++this.socketToken;
    this.ws = ws;

    ws.on('open', () => {
      if (token !== this.socketToken) return;
      this._onOpen();
    });
    ws.on('message', (d) => {
      if (token !== this.socketToken) return;
      this._onMessage(d);
    });
    ws.on('close', (code) => {
      if (token !== this.socketToken) return;
      this._onClose(code);
    });
    ws.on('error', (err) => {
      if (token !== this.socketToken) return;
      this._onError(err);
    });

    return { playerId: this.playerId, url };
  }

  disconnect() {
    this._clearTimers();
    this.state = 'disconnected';
    this.connectedAt = 0;
    this.welcomed = false;
    this.roomState = null;
    this.playerCount = 0;
    this.manualClose = true;
    this._clearRetryTimers();
    this.retryCount = 0;
    this.retryCode = null;
    this.initialConnectFastRetry = false;
    this.emit('status', { state: 'disconnected', code: 'client' });

    const ws = this.ws;
    this.ws = null;
    this.socketToken += 1;

    if (ws) {
      try {
        ws.close(1000, 'client disconnect');
      } catch (err) {
        // ignore
      }
      const killer = setTimeout(() => {
        try {
          ws.terminate();
        } catch (err) {
          // ignore
        }
      }, 1500);
      killer.unref?.();
    }
  }

  _onOpen() {
    this._send({ scopePath: ['Room'], type: 'VoteForGame', gameName: GAME_NAME });
    this._send({ scopePath: ['Room'], type: 'SetSelectedGame', gameName: GAME_NAME });

    this.textPing = setInterval(() => {
      this._send('ping');
    }, TEXT_MS);
    this.textPing.unref?.();

    this.appPing = setInterval(() => {
      this._send({
        scopePath: ['Room', GAME_NAME],
        type: 'Ping',
        id: Date.now(),
      });
    }, APP_MS);
    this.appPing.unref?.();
  }

  _onMessage(data) {
    const raw = String(data);
    this.emit('traffic', { direction: 'in', text: raw, ts: Date.now() });
    if (raw === 'ping' || raw === '"ping"' || raw === "'ping'") {
      this._send('pong');
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
      this.roomState = room;
      this.gameState = game;
      this._emitPlayerCount(room);
      this._emitLiveStatus();
      this._emitShops();
      if (!this.welcomed) {
        this.welcomed = true;
        this.connectedAt = Date.now();
        this.state = 'connected';
        this.retryCount = 0;
        this.retryCode = null;
        this.hasEverWelcomed = true;
        this.initialConnectFastRetry = false;
        this._clearRetryTimers();
        this.emit('status', {
          state: 'connected',
          room: this.room,
          version: this.version,
          playerId: this.playerId,
          connectedAt: this.connectedAt,
        });
        this._startTicker();
      }
      return;
    }

    if (msg.type !== 'PartialState' || !Array.isArray(msg.patches)) return;

    const logs = new Map();
    let seen = 0;
    let liveDirty = false;
    if (this.userSlotIndex == null && this.roomState) {
      const players = Array.isArray(this.roomState.players) ? this.roomState.players : [];
      const idx = players.findIndex((p) => p?.id === this.playerId);
      if (idx >= 0) this.userSlotIndex = idx;
    }
    for (const p of msg.patches) {
      if (!p || typeof p.path !== 'string') continue;

      if (/^\/data\/players\//.test(p.path) && this.roomState) {
        applyPatch(this.roomState, p.path, p.value, p.op);
        continue;
      }

      if (p.path.startsWith('/child/') && this.gameState) {
        applyPatch(this.gameState, p.path.replace(/^\/child/, ''), p.value, p.op);
        liveDirty = true;
      }

      const m =
        p.path.match(
          /\/child\/data\/userSlots\/(\d+)\/data\/activityLogs\/(\d+)\/(action|timestamp)(?:$|\/)/,
        ) ||
        p.path.match(/\/data\/activityLogs\/(\d+)\/(action|timestamp)(?:$|\/)/);
      if (m) {
        const slotIndex = m.length === 4 ? Number(m[1]) : null;
        const idx = m.length === 4 ? Number(m[2]) : Number(m[1]);
        const key = m.length === 4 ? m[3] : m[2];
        if (this.userSlotIndex != null && slotIndex == null) continue;
        if (this.userSlotIndex != null && slotIndex !== this.userSlotIndex) continue;
        const cur = logs.get(idx) || { idx, seen: 0 };
        if (key === 'action') cur.action = p.value;
        if (key === 'timestamp') cur.ts = p.value;
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
        if (this.userSlotIndex != null && slotIndex == null) continue;
        if (this.userSlotIndex != null && slotIndex !== this.userSlotIndex) continue;
        const cur = logs.get(idx) || { idx, seen: 0 };
        cur.petName = p.value;
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
        if (this.userSlotIndex != null && slotIndex == null) continue;
        if (this.userSlotIndex != null && slotIndex !== this.userSlotIndex) continue;
        const cur = logs.get(idx) || { idx, seen: 0 };
        cur.petSpecies = p.value;
        cur.seen = ++seen;
        logs.set(idx, cur);
      }
    }

    if (this.roomState) this._emitPlayerCount(this.roomState);
    if (liveDirty) {
      this._emitLiveStatus();
      this._emitShops();
    }

    const activityLogs =
      this.userSlotIndex != null
        ? this.gameState?.userSlots?.[this.userSlotIndex]?.data?.activityLogs
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
      if (Array.isArray(activityLogs) && activityLogs[best.idx]) {
        const pet = activityLogs[best.idx]?.parameters?.pet;
        if (pet) {
          if (best.petName == null && pet.name != null) best.petName = pet.name;
          if (best.petSpecies == null && pet.petSpecies != null) {
            best.petSpecies = pet.petSpecies;
          }
        }
      }
      const when = fmtDate(Date.now());
      const partialState = JSON.stringify(msg);
      this.emit('abilityLog', {
        when,
        action: best.action,
        petName: best.petName,
        petSpecies: best.petSpecies,
        partialState,
      });
    }
  }

  _onClose(code, reason) {
    this._clearTimers();
    this.state = 'disconnected';
    this.connectedAt = 0;
    this.welcomed = false;
    this.ws = null;
    const reasonText = Buffer.isBuffer(reason)
      ? reason.toString('utf8')
      : reason
        ? String(reason)
        : '';
    const info = { code, reason: reasonText };
    if (!this.manualClose) {
      const should = this._shouldReconnect(code);
      if (should) {
        const scheduled = this._scheduleReconnect(code, reasonText);
        if (scheduled) return;
        this.emit('status', { state: 'disconnected', ...info });
        return;
      }
      this.emit('status', { state: 'disconnected', ...info });
      return;
    }
    if (this.manualClose || code === 1000 || code === 1001) {
      this.emit('status', { state: 'disconnected', ...info });
      return;
    }
    this.emit('status', {
      state: 'error',
      message: reasonText ? `Disconnected (${code}): ${reasonText}` : `Disconnected (${code})`,
      ...info,
    });
  }

  _onError(err) {
    this.emit('status', {
      state: 'error',
      message: err && err.message ? err.message : String(err),
    });
  }

  _send(payload) {
    if (!this.ws || this.ws.readyState !== WS.OPEN) return;
    if (payload && typeof payload === 'object') {
      const type = payload.type;
      if (type === 'VoteForGame' || type === 'SetSelectedGame') {
        this.emit('gameAction', {
          type,
          gameName: payload.gameName || '',
          scopePath: Array.isArray(payload.scopePath) ? payload.scopePath : [],
        });
      }
    }
    const out = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.ws.send(out);
    this.emit('traffic', { direction: 'out', text: out, ts: Date.now() });
  }

  _emitPlayerCount(room) {
    const count = Array.isArray(room?.players)
      ? room.players.filter((p) => p && p.isConnected).length
      : 0;
    if (count !== this.playerCount) {
      this.playerCount = count;
      this.emit('players', { count });
    }
  }

  _emitLiveStatus() {
    const room = this.roomState;
    const game = this.gameState;
    const players = Array.isArray(room?.players) ? room.players : [];
    const index = players.findIndex((p) => p?.id === this.playerId);
    if (index >= 0) this.playerIndex = index;
    const slotIndex = findUserSlotIndex(room, game, this.playerId, this.playerIndex);
    if (slotIndex != null) {
      this.userSlotIndex = slotIndex;
    } else if (this.userSlotIndex == null && this.playerIndex >= 0) {
      this.userSlotIndex = this.playerIndex;
    }

    const me = players.find((p) => p?.id === this.playerId);
    const slot = pickUserSlot(room, game, this.playerId, this.playerIndex);
    const pets = extractPets(slot);

    const payload = {
      playerId: this.playerId,
      playerName: me?.name || '',
      roomId: room?.roomId || '',
      roomSessionId: room?.roomSessionId || '',
      host: room?.hostPlayerId === this.playerId,
      pets,
    };

    const key = JSON.stringify(payload);
    if (key === this.lastLiveKey) return;
    this.lastLiveKey = key;
    this.emit('liveStatus', payload);
  }

  _emitShops() {
    const shops = this.gameState?.shops;
    if (!shops) return;
    const payload = {
      seed: extractShopItems(shops.seed, 'species'),
      tool: extractShopItems(shops.tool, 'toolId'),
      egg: extractShopItems(shops.egg, 'eggId'),
      decor: extractShopItems(shops.decor, 'decorId'),
      restock: {
        seed: shops.seed?.secondsUntilRestock,
        tool: shops.tool?.secondsUntilRestock,
        egg: shops.egg?.secondsUntilRestock,
        decor: shops.decor?.secondsUntilRestock,
      },
    };
    const key = JSON.stringify(payload);
    if (key === this.lastShopsKey) return;
    this.lastShopsKey = key;
    this.emit('shops', payload);
  }

  _startTicker() {
    this._clearTicker();
    this.ticker = setInterval(() => {
      if (!this.connectedAt) return;
      const ms = Date.now() - this.connectedAt;
      this.emit('uptime', { ms, text: fmtDuration(ms) });
    }, 1000);
    this.ticker.unref?.();
  }

  _clearTicker() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  _clearTimers() {
    this._clearTicker();
    if (this.textPing) clearInterval(this.textPing);
    if (this.appPing) clearInterval(this.appPing);
    this.textPing = null;
    this.appPing = null;
  }

  _clearRetryTimers() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.retryCountdownTimer) clearInterval(this.retryCountdownTimer);
    this.retryTimer = null;
    this.retryCountdownTimer = null;
    this.retryDeadline = 0;
  }

  _updateReconnectConfig(config) {
    if (!config || typeof config !== 'object') return;
    if (typeof config.unknown === 'boolean') {
      this.reconnectConfig.unknown = config.unknown;
    }
    if (Number.isFinite(config.delayMs)) {
      const next = Math.max(0, Math.floor(config.delayMs));
      this.reconnectConfig.delays.supersededMs = next;
      this.reconnectConfig.delays.otherMs = next;
    }
    if (config.delays && typeof config.delays === 'object') {
      if (Number.isFinite(config.delays.supersededMs)) {
        this.reconnectConfig.delays.supersededMs = Math.max(
          0,
          Math.floor(config.delays.supersededMs),
        );
      }
      if (Number.isFinite(config.delays.otherMs)) {
        this.reconnectConfig.delays.otherMs = Math.max(0, Math.floor(config.delays.otherMs));
      } else if (Number.isFinite(config.delays.updateMs)) {
        this.reconnectConfig.delays.otherMs = Math.max(0, Math.floor(config.delays.updateMs));
      }
    }
    if (config.codes && typeof config.codes === 'object') {
      for (const [key, value] of Object.entries(config.codes)) {
        const code = Number(key);
        if (Number.isFinite(code)) {
          this.reconnectConfig.codes[code] = Boolean(value);
        }
      }
    }
  }

  _shouldReconnect(code) {
    if (!Number.isFinite(code)) return Boolean(this.reconnectConfig.unknown);
    if (!KNOWN_CLOSE_CODES.has(code)) return Boolean(this.reconnectConfig.unknown);
    return Boolean(this.reconnectConfig.codes[code]);
  }

  _getReconnectDelay(code) {
    const otherDelay = Math.max(0, this.reconnectConfig.delays.otherMs || 0);
    if (!Number.isFinite(code)) return otherDelay;
    if (!KNOWN_CLOSE_CODES.has(code)) return otherDelay;
    if (RECONNECT_DELAY_GROUPS.superseded.has(code)) {
      return Math.max(0, this.reconnectConfig.delays.supersededMs || 0);
    }
    return otherDelay;
  }

  _getMaxRetries(code) {
    if (code === 4800) return RETRY_MAX;
    return 1;
  }

  _scheduleReconnect(code, reasonText) {
    const isInitial = this.initialConnectFastRetry && !this.hasEverWelcomed;
    const maxRetries = isInitial ? 5 : this._getMaxRetries(code);
    if (!isInitial && !this._shouldReconnect(code)) return false;
    if (!this.lastConnectOpts) return false;
    if (!isInitial && this.retryCode !== code) {
      this.retryCode = code;
      this.retryCount = 0;
    } else if (this.retryCode == null) {
      this.retryCode = code;
    }
    if (this.retryCount >= maxRetries) return false;
    const isFirstTry = this.retryCount === 0;
    this.retryCount += 1;
    const attempt = this.retryCount;
    const delay = isInitial ? 0 : this._getReconnectDelay(code);
    const retryInMs = delay;
    this.state = 'connecting';
    this.emit('status', {
      state: 'reconnecting',
      retry: attempt,
      maxRetries,
      code,
      reason: reasonText,
      retryInMs,
    });

    this._clearRetryTimers();
    this.retryDeadline = Date.now() + retryInMs;
    if (retryInMs > 0) {
      this.retryCountdownTimer = setInterval(() => {
        const remaining = Math.max(0, this.retryDeadline - Date.now());
        this.emit('status', {
          state: 'reconnecting',
          retry: attempt,
          maxRetries,
          code,
          reason: reasonText,
          retryInMs: remaining,
        });
        if (remaining <= 0) {
          this._clearRetryTimers();
        }
      }, 500);
      this.retryCountdownTimer.unref?.();
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      try {
        this.connect(this.lastConnectOpts, { isRetry: true });
      } catch (err) {
        this.emit('status', {
          state: 'error',
          message: err && err.message ? err.message : String(err),
        });
      }
    }, retryInMs);
    this.retryTimer.unref?.();
    return true;
  }
}

module.exports = { RoomClient };
