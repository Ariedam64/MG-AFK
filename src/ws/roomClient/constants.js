'use strict';

const DEFAULT_HOST = 'magicgarden.gg';
const DEFAULT_VERSION = 'db34dc9';
const TEXT_MS = 2000;
const APP_MS = 2000;
const GAME_NAME = 'Quinoa';
const DEFAULT_UA = 'Mozilla/5.0';
const RETRY_MAX = 15;
const RETRY_DELAY_MS = 1500;
const RETRY_JITTER_MS = 1000;
const RETRY_MAX_DELAY_MS = 60000;
const KNOWN_CLOSE_CODES = new Set([
  4100, 4200, 4250, 4300, 4310, 4400, 4500, 4700, 4710, 4800,
]);
const RECONNECT_DELAY_GROUPS = {
  superseded: new Set([4250, 4300]),
};
const BLOCKED_ABILITIES = new Set(['dawnkisser', 'moonkisser']);

module.exports = {
  DEFAULT_HOST,
  DEFAULT_VERSION,
  TEXT_MS,
  APP_MS,
  GAME_NAME,
  DEFAULT_UA,
  RETRY_MAX,
  RETRY_DELAY_MS,
  RETRY_JITTER_MS,
  RETRY_MAX_DELAY_MS,
  KNOWN_CLOSE_CODES,
  RECONNECT_DELAY_GROUPS,
  BLOCKED_ABILITIES,
};
