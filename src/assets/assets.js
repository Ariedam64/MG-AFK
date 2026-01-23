'use strict';
const { fetchGameVersion } = require('./gameVersion');

const ORIGIN = 'https://magicgarden.gg';
let cachedBaseUrl = null;
let pendingPromise = null;

async function getBaseUrl() {
  if (cachedBaseUrl) {
    return cachedBaseUrl;
  }

  if (pendingPromise) {
    return pendingPromise;
  }

  pendingPromise = (async () => {
    try {
      const version = await fetchGameVersion();
      if (!version) {
        return null;
      }

      const url = `${ORIGIN}/version/${version}/assets/`;
      cachedBaseUrl = url;
      return url;
    } catch {
      return null;
    }
  })();

  try {
    return await pendingPromise;
  } finally {
    pendingPromise = null;
  }
}

async function getAssetUrl(relativePath) {
  const baseUrl = await getBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const cleanPath = relativePath ? relativePath.replace(/^\/+/, '') : '';
  return new URL(cleanPath, baseUrl).toString();
}

async function initializeBaseUrl() {
  await getBaseUrl();
}

function isReady() {
  return Boolean(cachedBaseUrl);
}

module.exports = {
  initializeBaseUrl,
  getBaseUrl,
  getAssetUrl,
  isReady,
};
