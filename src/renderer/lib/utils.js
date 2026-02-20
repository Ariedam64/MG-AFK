import { SHOP_LABELS, PET_HUNGER_COSTS } from './constants.js';

export const clone = (value) => JSON.parse(JSON.stringify(value));

export const formatLogTime = (ts) =>
  new Date(ts).toLocaleTimeString('fr-FR', { hour12: false });

export const truncateText = (text, max = 180) => {
  const value = String(text || '');
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
};

export const copyTextToClipboard = async (text) => {
  if (!text) return false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall back to execCommand
    }
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', 'true');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(el);
  return ok;
};

export const generateSessionId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const isAlertShop = (value) =>
  value === 'weather' ||
  value === 'pet' ||
  Object.prototype.hasOwnProperty.call(SHOP_LABELS, value);

export const getHungerLimit = (species) => {
  const key = String(species || '')
    .toLowerCase()
    .replace(/\s+/g, '');
  return PET_HUNGER_COSTS[key] || null;
};

export const getPetLabel = (pet) =>
  pet?.name || pet?.species || `Pet ${Number(pet?.index || 0) + 1}`;

export const getPetKey = (pet) => {
  const id = String(pet?.id || '').trim();
  if (id) return `id:${id}`;
  const name = String(pet?.name || '').trim();
  const species = String(pet?.species || '').trim();
  const index = Number.isFinite(pet?.index) ? pet.index : '';
  return `pet:${name}|${species}|${index}`;
};

export const getPetHungerPct = (pet) => {
  const limit = getHungerLimit(pet?.species);
  if (!Number.isFinite(pet?.hunger) || !limit) return null;
  return Math.min(100, Math.max(0, (pet.hunger / limit) * 100));
};
