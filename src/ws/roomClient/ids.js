'use strict';
const crypto = require('crypto');

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const generatePlayerId = () => {
  const bytes = crypto.randomBytes(16);
  let id = '';
  for (const b of bytes) {
    id += BASE58_ALPHABET[b % BASE58_ALPHABET.length];
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

module.exports = { generatePlayerId, generateRoomId, normalizeCookie };
