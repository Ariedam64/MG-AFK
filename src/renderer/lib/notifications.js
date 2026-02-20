import { ALERT_SOUND_URL, PET_HUNGER_SOUND_URL } from './constants.js';

export const playAlertSound = async (url = ALERT_SOUND_URL) => {
  if (!url) return;
  const audio = new Audio(url);
  audio.volume = 0.9;
  try {
    await audio.play();
  } catch {
    // Ignore blocked playback.
  }
};

export const getNotifyMode = (alertState) =>
  alertState.notifyMode === 'sound' ? 'sound' : 'windows';

const buildNotificationBody = (title, body) => {
  const header = String(title || '').trim();
  const detail = String(body || '').trim();
  if (header && detail) return `${header}\n${detail}`;
  return header || detail || 'Notification';
};

export const notifyAlert = async ({ title, body, sound } = {}, alertState) => {
  if (getNotifyMode(alertState) === 'sound') {
    const soundUrl = sound === 'petHunger' ? PET_HUNGER_SOUND_URL : ALERT_SOUND_URL;
    await playAlertSound(soundUrl);
    return;
  }
  if (!window.api?.notify) return;
  window.api.notify({ title: 'MG AFK', body: buildNotificationBody(title, body) });
};

export const notifyShopRestock = (shopLabel, items, alertState) => {
  if (!Array.isArray(items) || items.length === 0) return;
  const title = `Shop restock: ${shopLabel}`;
  const body = items.map((item) => item.name).join(', ');
  notifyAlert({ title, body }, alertState);
};

export const notifyWeatherChange = (weather, alertState) => {
  const title = 'Weather update';
  const body = `Weather: ${weather}`;
  notifyAlert({ title, body }, alertState);
};

export const notifyPetHunger = (pets, alertState) => {
  if (!Array.isArray(pets) || pets.length === 0) return;
  const title = 'Pet hunger alert';
  const body = pets
    .map((pet) => `${pet.label} ${Math.round(pet.pct)}%`)
    .join(', ');
  notifyAlert({ title, body, sound: 'petHunger' }, alertState);
};
