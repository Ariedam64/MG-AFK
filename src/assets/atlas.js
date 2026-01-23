'use strict';
const https = require('https');
const zlib = require('zlib');
const path = require('path');
const { getBaseUrl } = require('./assets');
const { loadManifest, getBundleByName, extractJsonFiles } = require('./manifest');

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

function joinUrl(baseUrl, relativePath) {
  return new URL(relativePath, baseUrl).toString();
}

function resolveRelativePath(fromPath, relativePath) {
  if (!relativePath) {
    return relativePath;
  }

  if (relativePath.startsWith('/')) {
    return relativePath.replace(/^\/+/, '');
  }

  const baseDir = path.posix.dirname(fromPath);
  if (baseDir === '.') {
    return path.posix.normalize(relativePath);
  }

  return path.posix.normalize(path.posix.join(baseDir, relativePath));
}

function isAtlas(json) {
  return (
    json &&
    typeof json === 'object' &&
    json.frames &&
    json.meta &&
    typeof json.meta.image === 'string'
  );
}

function buildAtlasAnimations(atlasJson, outAnimMap) {
  if (!atlasJson.animations || typeof atlasJson.animations !== 'object') {
    return;
  }

  for (const [animKey, frames] of Object.entries(atlasJson.animations)) {
    if (!Array.isArray(frames)) {
      continue;
    }

    const frameKeys = frames.filter((frame) => typeof frame === 'string');
    if (frameKeys.length >= 2) {
      outAnimMap.set(animKey, frameKeys);
    }
  }
}

function buildCategoryIndex(atlasJson, categoryIndex) {
  const addCategory = (cat, id) => {
    const category = String(cat || '').trim();
    const item = String(id || '').trim();
    if (!category || !item) {
      return;
    }

    if (!categoryIndex.has(category)) {
      categoryIndex.set(category, new Set());
    }
    categoryIndex.get(category).add(item);
  };

  for (const key of Object.keys(atlasJson.frames || {})) {
    const match = /^sprite\/([^/]+)\/(.+)$/.exec(key);
    if (match) {
      addCategory(match[1], match[2]);
    }
  }
}

async function loadAtlasJson(
  baseUrl,
  atlasPath,
  seen,
  atlases,
  animations,
  categoryIndex,
) {
  if (seen.has(atlasPath)) {
    return;
  }
  seen.add(atlasPath);

  const atlas = await fetchJson(joinUrl(baseUrl, atlasPath));
  if (!isAtlas(atlas)) {
    return;
  }

  atlases.set(atlasPath, atlas);
  buildAtlasAnimations(atlas, animations);
  buildCategoryIndex(atlas, categoryIndex);

  const related = atlas.meta && atlas.meta.related_multi_packs;
  if (Array.isArray(related)) {
    for (const rel of related) {
      const relPath = resolveRelativePath(atlasPath, rel);
      await loadAtlasJson(baseUrl, relPath, seen, atlases, animations, categoryIndex);
    }
  }
}

async function loadAtlasesFromManifest(options = {}) {
  const baseUrl = options.baseUrl || (await getBaseUrl());
  if (!baseUrl) {
    return null;
  }

  const manifest = await loadManifest({ baseUrl });
  if (!manifest) {
    return null;
  }

  const bundleName = options.bundleName || 'default';
  const bundle = getBundleByName(manifest, bundleName);
  if (!bundle) {
    throw new Error(`Bundle not found: ${bundleName}`);
  }

  const jsonPaths = extractJsonFiles(bundle);
  const seen = new Set();
  const atlases = new Map();
  const animations = new Map();
  const categoryIndex = new Map();

  for (const jsonPath of jsonPaths) {
    await loadAtlasJson(baseUrl, jsonPath, seen, atlases, animations, categoryIndex);
  }

  return {
    atlases,
    animations,
    categoryIndex,
  };
}

module.exports = {
  isAtlas,
  loadAtlasesFromManifest,
  buildAtlasAnimations,
  buildCategoryIndex,
};
