export const storageKeys = {
  sessions: 'mgafk.sessions',
  activeSession: 'mgafk.activeSession',
  alerts: 'mgafk.alerts',
};

export const PET_HUNGER_COSTS = {
  worm: 500,
  snail: 1000,
  bee: 1500,
  chicken: 3000,
  bunny: 750,
  dragonfly: 250,
  pig: 50000,
  cow: 25000,
  turkey: 500,
  squirrel: 15000,
  turtle: 100000,
  goat: 20000,
  snowfox: 14000,
  stoat: 10000,
  whitecaribou: 30000,
  caribou: 30000,
  pony:4000,
  horse:4000,
  firehorse:200000,
  butterfly: 25000,
  capybara: 150000,
  peacock: 100000,
};

export const RECONNECT_DELAY_LIMITS = {
  superseded: { min: 10, max: 60 },
  other: { min: 0, max: 15 },
};

export const DEFAULT_RECONNECT = {
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

export const RECONNECT_GROUPS = {
  superseded: [4250, 4300],
  other: [4100, 4200, 4310, 4400, 4500, 4700, 4710, 4800],
};

export const RECONNECT_DELAY_KEYS = {
  superseded: 'supersededMs',
  other: 'otherMs',
};

export const DEFAULT_GAME_URL = 'https://magicgarden.gg';

export const SHOP_LABELS = {
  seed: 'Seeds',
  tool: 'Tools',
  egg: 'Eggs',
  decor: 'Decors',
};

export const RESTOCK_SECONDS = {
  seed: 300,
  tool: 600,
  egg: 900,
  decor: 3600,
};

export const WEATHER_ALERTS = [
  { key: 'Clear Skies', label: 'Clear Skies' },
  { key: 'Rain', label: 'Rain' },
  { key: 'Snow', label: 'Snow' },
  { key: 'Amber Moon', label: 'Amber Moon' },
  { key: 'Dawn', label: 'Dawn' },
];

export const WEATHER_ICON_LABELS = {
  'Clear Skies': ['Sunny', 'ClearSkies', 'WeatherSunny'],
  Rain: ['Rain', 'WeatherRain'],
  Snow: ['Snow', 'WeatherSnow', 'Frost'],
  'Amber Moon': ['AmberMoon', 'AmberMoonWeather', 'Amber'],
  Dawn: ['Dawn', 'WeatherDawn'],
};

export const PET_HUNGER_ALERT_ITEM = 'hunger<5';
export const PET_HUNGER_THRESHOLD = 5;
export const DEV_LOG_LIMIT = 300;

export const DEFAULT_ALERT_STATE = {
  shop: 'seed',
  notifyMode: 'windows',
  selected: {},
  catalog: { seed: [], tool: [], egg: [], decor: [] },
  triggered: {},
};

export const ALERT_SOUND_URL = (() => {
  try {
    return new URL('assets/notif.mp3', window.location.href).toString();
  } catch {
    return 'assets/notif.mp3';
  }
})();

export const PET_HUNGER_SOUND_URL = (() => {
  try {
    return new URL('assets/pethunger.mp3', window.location.href).toString();
  } catch {
    return 'assets/pethunger.mp3';
  }
})();
