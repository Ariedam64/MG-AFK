'use strict';

const decodePointer = (path) =>
  path
    .split('/')
    .slice(1)
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));

const isNumeric = (v) => String(v).match(/^\d+$/);

const applyPatch = (target, path, value, op) => {
  if (!target || typeof path !== 'string') return;
  const segs = decodePointer(path);
  if (!segs.length) return;

  let idx = 0;
  if (segs[0] === 'data') idx = 1;

  let cur = target;
  for (let i = idx; i < segs.length - 1; i += 1) {
    const key = segs[i];
    if (cur[key] == null || typeof cur[key] !== 'object') {
      const next = segs[i + 1];
      cur[key] = isNumeric(next) ? [] : {};
    }
    cur = cur[key];
  }

  const last = segs[segs.length - 1];
  if (op === 'remove') {
    if (Array.isArray(cur)) {
      const n = Number(last);
      if (!Number.isNaN(n)) cur.splice(n, 1);
    } else {
      delete cur[last];
    }
    return;
  }

  cur[last] = value;
};

module.exports = { applyPatch };
