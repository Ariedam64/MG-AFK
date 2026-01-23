'use strict';

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

const formatWeather = (value) => {
  if (value == null) return 'Clear Skies';
  const raw = String(value || '').trim();
  if (!raw) return 'Clear Skies';
  const key = raw.toLowerCase();
  if (key === 'sunny') return 'Clear Skies';
  if (key === 'rain') return 'Rain';
  if (key === 'frost') return 'Snow';
  if (key === 'amber moon') return 'Amber Moon';
  if (key === 'dawn') return 'Dawn';
  return raw;
};

module.exports = { fmtDuration, fmtDate, formatWeather };
