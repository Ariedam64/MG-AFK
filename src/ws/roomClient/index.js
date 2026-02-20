'use strict';
const EventEmitter = require('events');
const WS = require('ws');

const {
  DEFAULT_HOST,
  DEFAULT_VERSION,
  DEFAULT_UA,
  RETRY_MAX,
  RETRY_DELAY_MS,
  RETRY_JITTER_MS,
  RETRY_MAX_DELAY_MS,
  KNOWN_CLOSE_CODES,
  RECONNECT_DELAY_GROUPS,
} = require('./constants');
const { fmtDuration, formatWeather } = require('./format');
const { generatePlayerId, generateRoomId, normalizeCookie } = require('./ids');
const { buildUrl } = require('./url');
const { findUserSlotIndex, pickUserSlot } = require('./state');
const { extractPets, formatPetMutations } = require('./pets');
const { extractShopItems, extractShopCatalog } = require('./shops');
const { onOpen, onMessage, onClose, onError } = require('./handlers');

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
    this.mutationLogged = false;
    this.reconnectConfig = {
      unknown: true,
      delays: {
        supersededMs: 30000,
        otherMs: 1500,
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

  _failAuth(message) {
    const msg = message || 'Authentication failed.';
    this._clearTimers();
    this._clearRetryTimers();
    this.state = 'error';
    this.connectedAt = 0;
    this.welcomed = false;
    this.roomState = null;
    this.gameState = null;
    this.playerCount = 0;
    this.retryCount = 0;
    this.retryCode = null;
    this.initialConnectFastRetry = false;
    this.emit('status', { state: 'error', message: msg, code: 4800 });

    const ws = this.ws;
    this.ws = null;
    this.socketToken += 1;
    if (ws) {
      try {
        ws.close(1000, 'auth failed');
      } catch (err) {
        // ignore
      }
      try {
        ws.terminate();
      } catch (err) {
        // ignore
      }
    }
  }

  connect({ version, cookie, host, userAgent, reconnect, room } = {}, meta = {}) {
    const isRetry = Boolean(meta && meta.isRetry);
    const nextVersion = String(version || '').trim();
    const nextCookie = normalizeCookie(cookie);
    const nextRoom = String(room || '').trim();

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
    this.room = nextRoom || generateRoomId();
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
    this.mutationLogged = false;
    if (!isRetry) {
      this.initialConnectFastRetry = !this.hasEverWelcomed;
    }
    this.lastConnectOpts = {
      version: this.version,
      room: this.room,
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
    onOpen(this);
  }

  _onMessage(data) {
    onMessage(this, data);
  }

  _onClose(code, reason) {
    onClose(this, code, reason);
  }

  _onError(err) {
    onError(this, err);
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
      weather: game ? formatWeather(game.weather) : '',
      pets,
    };

    this._maybeLogPetMutations(slot);

    const key = JSON.stringify(payload);
    if (key === this.lastLiveKey) return;
    this.lastLiveKey = key;
    this.emit('liveStatus', payload);
  }

  _maybeLogPetMutations(slot) {
    if (this.mutationLogged) return;
    const data = slot?.data || slot;
    const petSlots = Array.isArray(data?.petSlots) ? data.petSlots : null;
    if (!petSlots) return;
    const slotIndex =
      typeof this.userSlotIndex === 'number' ? this.userSlotIndex : null;
    const mutationSummary = formatPetMutations(slot);
    const mutationDetail =
      slotIndex != null ? `slot=${slotIndex} | ${mutationSummary}` : mutationSummary;
    this.emit('debug', {
      level: 'info',
      message: 'pet mutations',
      detail: mutationDetail,
    });
    this.mutationLogged = true;
  }

  _emitShops() {
    const shops = this.gameState?.shops;
    if (!shops) return;
    const payload = {
      seed: extractShopItems(shops.seed, 'species'),
      tool: extractShopItems(shops.tool, 'toolId'),
      egg: extractShopItems(shops.egg, 'eggId'),
      decor: extractShopItems(shops.decor, 'decorId'),
      catalog: {
        seed: extractShopCatalog(shops.seed, 'species'),
        tool: extractShopCatalog(shops.tool, 'toolId'),
        egg: extractShopCatalog(shops.egg, 'eggId'),
        decor: extractShopCatalog(shops.decor, 'decorId'),
      },
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
    let configuredDelay;
    if (Number.isFinite(code) && RECONNECT_DELAY_GROUPS.superseded.has(code)) {
      configuredDelay = Math.max(0, this.reconnectConfig.delays.supersededMs || 0);
    } else {
      configuredDelay = Math.max(0, this.reconnectConfig.delays.otherMs || 0);
    }
    const base = Math.max(configuredDelay, RETRY_DELAY_MS);
    const backoff = Math.min(
      base * Math.pow(2, Math.max(0, this.retryCount - 1)),
      RETRY_MAX_DELAY_MS,
    );
    const jitter = Math.floor(Math.random() * RETRY_JITTER_MS);
    return backoff + jitter;
  }

  _getMaxRetries(code) {
    if (code === 4800) return 5;
    return RETRY_MAX;
  }

  _scheduleReconnect(code, reasonText) {
    const isInitial = this.initialConnectFastRetry && !this.hasEverWelcomed;
    const maxRetries = isInitial ? 5 : this._getMaxRetries(code);
    if (!isInitial && !this._shouldReconnect(code)) return false;
    if (!this.lastConnectOpts) return false;
    this.retryCode = code;
    if (this.retryCount >= maxRetries) return false;
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
