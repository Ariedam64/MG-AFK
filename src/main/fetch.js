'use strict';
const http = require('http');
const https = require('https');
const zlib = require('zlib');

const REPO_OWNER = 'Ariedam64';
const REPO_NAME = 'MG-AFK';

const fetchAssetBuffer = (url, redirectsLeft = 3) =>
  new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(
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
          resolve(fetchAssetBuffer(nextUrl, redirectsLeft - 1));
          return;
        }

        if (res.statusCode && res.statusCode >= 400) {
          res.resume();
          reject(new Error(`Asset fetch failed (${res.statusCode})`));
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

        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: res.headers['content-type'] || '',
          });
        });
        stream.on('error', reject);
      },
    );
    req.on('error', reject);
  });

const fetchAssetJson = async (url) => {
  const { buffer } = await fetchAssetBuffer(url);
  return JSON.parse(buffer.toString('utf8'));
};

const fetchLatestRelease = () =>
  new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'MG-AFK',
          Accept: 'application/vnd.github+json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode === 404) { resolve(null); return; }
          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            reject(new Error(`GitHub ${res.statusCode}`));
            return;
          }
          try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
        });
      },
    );
    req.on('error', reject);
  });

const normalizeVersion = (value) => String(value || '').trim().replace(/^v/i, '');

const parseVersion = (value) => {
  const cleaned = normalizeVersion(value);
  const match = cleaned.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  const nums = match.slice(1).filter(Boolean).map((part) => Number(part));
  while (nums.length < 3) nums.push(0);
  return nums;
};

const compareVersions = (a, b) => {
  for (let i = 0; i < 3; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff > 0) return 1;
    if (diff < 0) return -1;
  }
  return 0;
};

module.exports = {
  REPO_OWNER,
  REPO_NAME,
  fetchAssetBuffer,
  fetchAssetJson,
  fetchLatestRelease,
  normalizeVersion,
  parseVersion,
  compareVersions,
};
