'use strict';
const http = require('http');
const https = require('https');
const zlib = require('zlib');

const DEFAULT_ORIGIN = 'https://magicgarden.gg';
const VERSION_PATH = '/platform/v1/version';
const MAX_REDIRECTS = 4;

let cachedVersion = null;
let pendingPromise = null;

const fetchGameVersion = ({ origin = DEFAULT_ORIGIN, logger } = {}) => {
  if (cachedVersion) return Promise.resolve(cachedVersion);
  if (pendingPromise) return pendingPromise;

  const log = (level, message, detail) => {
    if (typeof logger === 'function') {
      logger(level, message, detail);
    }
  };

  const requestUrl = (url, depth) =>
    new Promise((resolve, reject) => {
      log('info', 'version fetch', url);
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
          const status = res.statusCode || 0;
          const encoding = res.headers['content-encoding'] || 'identity';
          log('info', 'version fetch status', `${status} ${encoding}`);

          if (status >= 300 && status < 400 && res.headers.location) {
            if (depth >= MAX_REDIRECTS) {
              res.resume();
              reject(new Error('Too many redirects'));
              return;
            }
            const nextUrl = new URL(res.headers.location, url).toString();
            log('info', 'version redirect', nextUrl);
            res.resume();
            resolve(requestUrl(nextUrl, depth + 1));
            return;
          }

          if (status >= 400) {
            res.resume();
            log('error', 'version fetch status', String(status));
            reject(new Error(`Version fetch failed (${status})`));
            return;
          }

          let stream = res;
          if (encoding === 'br') {
            stream = res.pipe(zlib.createBrotliDecompress());
          } else if (encoding === 'gzip') {
            stream = res.pipe(zlib.createGunzip());
          } else if (encoding === 'deflate') {
            stream = res.pipe(zlib.createInflate());
          }

          let data = '';
          stream.setEncoding('utf8');
          stream.on('data', (chunk) => {
            data += chunk;
          });
          stream.on('end', () => {
            log('info', 'version fetch bytes', String(data.length));
            let payload;
            try {
              payload = JSON.parse(data);
            } catch (err) {
              const snippet = data.slice(0, 800);
              log(
                'error',
                'version parse failed',
                snippet.replace(/\s+/g, ' ').slice(0, 200),
              );
              reject(new Error('Invalid version response'));
              return;
            }
            const version = payload && typeof payload.version === 'string'
              ? payload.version.trim()
              : '';
            if (!version) {
              log('error', 'version missing', JSON.stringify(payload || {}));
              reject(new Error('Version not found'));
              return;
            }
            log('info', 'version found', version);
            resolve(version);
          });
          stream.on('error', (err) => {
            log('error', 'version decode error', err.message || String(err));
            reject(err);
          });
        },
      );

      req.on('error', (err) => {
        log('error', 'version fetch error', err.message || String(err));
        reject(err);
      });
      req.setTimeout(8000, () => {
        req.destroy(new Error('Version fetch timeout'));
      });
    });

  pendingPromise = (async () => {
    try {
      const base = String(origin || DEFAULT_ORIGIN).replace(/\/+$/, '');
      const url = `${base}${VERSION_PATH}`;
      const version = await requestUrl(url, 0);
      cachedVersion = version;
      return version;
    } finally {
      pendingPromise = null;
    }
  })();

  return pendingPromise;
};

module.exports = {
  fetchGameVersion,
};
