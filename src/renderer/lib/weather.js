import { WEATHER_ALERTS, WEATHER_ICON_LABELS } from './constants.js';

export const resolveWeatherKey = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  const match = WEATHER_ALERTS.find(
    (option) => option.key.toLowerCase() === text || option.label.toLowerCase() === text,
  );
  return match ? match.key : '';
};

export const getWeatherCandidates = (value) => {
  const key = resolveWeatherKey(value) || String(value || '').trim();
  if (!key) return [];
  const candidates = WEATHER_ICON_LABELS[key] || [key];
  return candidates.filter(Boolean);
};

export const resolveWeatherIconUrl = async (value) => {
  if (!window.spriteResolver?.getIcon) return null;
  const candidates = getWeatherCandidates(value);
  for (const candidate of candidates) {
    const url = await window.spriteResolver.getIcon({
      shop: 'ui',
      item: candidate,
      size: 16,
    });
    if (url) return url;
  }
  return null;
};

let weatherIconKey = '';

export const updateWeatherIcon = async (value) => {
  const weatherIcon = document.getElementById('weatherIcon');
  if (!weatherIcon) return;
  const key = resolveWeatherKey(value) || String(value || '').trim();
  if (!key) {
    weatherIconKey = '';
    weatherIcon.removeAttribute('src');
    weatherIcon.classList.add('sprite-placeholder');
    return;
  }
  if (weatherIconKey === key) return;
  weatherIconKey = key;
  weatherIcon.removeAttribute('src');
  weatherIcon.classList.add('sprite-placeholder');
  const url = await resolveWeatherIconUrl(key);
  if (!url) return;
  weatherIcon.src = url;
  weatherIcon.classList.remove('sprite-placeholder');
};

export const resetWeatherIconKey = () => {
  weatherIconKey = '';
};
