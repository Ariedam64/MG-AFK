'use strict';
const https = require('https');
const zlib = require('zlib');
const { getBaseUrl } = require('./assets');

const MANIFEST_FILENAME = 'manifest.json';
const cachedManifests = new Map();
const pendingManifests = new Map();

function fetchJson(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      },
      (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location &&
        redirectsLeft > 0
      ) {
        const nextUrl = new URL(res.headers.location, url).toString();
        res.resume();
        resolve(fetchJson(nextUrl, redirectsLeft - 1));
        return;
      }

      const encoding = res.headers['content-encoding'] || 'identity';
      let stream = res;
      if (encoding === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
      } else if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      }

      let data = '';
      stream.on('data', (chunk) => {
        data += chunk;
      });
      stream.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
      stream.on('error', reject);
    },
    );

    req.on('error', reject);
  });
}

async function loadManifest(options = {}) {
  const baseUrl = options.baseUrl || (await getBaseUrl());
  if (!baseUrl) {
    return null;
  }

  if (cachedManifests.has(baseUrl)) {
    return cachedManifests.get(baseUrl);
  }

  if (pendingManifests.has(baseUrl)) {
    return pendingManifests.get(baseUrl);
  }

  const manifestUrl = new URL(MANIFEST_FILENAME, baseUrl).toString();
  const promise = fetchJson(manifestUrl);
  pendingManifests.set(baseUrl, promise);

  try {
    const manifest = await promise;
    cachedManifests.set(baseUrl, manifest);
    return manifest;
  } finally {
    pendingManifests.delete(baseUrl);
  }
}

function getBundleByName(manifest, bundleName) {
  if (!manifest || !Array.isArray(manifest.bundles)) {
    return null;
  }

  return manifest.bundles.find((bundle) => bundle.name === bundleName) || null;
}

function extractJsonFiles(bundle) {
  if (!bundle || !Array.isArray(bundle.assets)) {
    return [];
  }

  const jsonFiles = new Set();

  for (const asset of bundle.assets) {
    const sources = Array.isArray(asset.src) ? asset.src : [];
    for (const src of sources) {
      if (
        typeof src === 'string' &&
        src.endsWith('.json') &&
        src !== MANIFEST_FILENAME
      ) {
        jsonFiles.add(src);
      }
    }
  }

  return Array.from(jsonFiles);
}

module.exports = {
  loadManifest,
  getBundleByName,
  extractJsonFiles,
};
