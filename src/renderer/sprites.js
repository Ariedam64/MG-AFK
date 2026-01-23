(() => {
  if (!window.api?.assetsManifest || !window.api?.assetsJson || !window.api?.assetsImage) {
    window.spriteResolver = {
      getIcon: async () => null,
      preload: () => null,
      isReady: () => false,
    };
    return;
  }

  const spriteIndex = {
    entries: new Map(),
    byCategory: new Map(),
    byName: new Map(),
    ready: false,
  };

  const imageCache = new Map();
  const iconCache = new Map();
  const pendingIcons = new Map();
  let indexPromise = null;

  const MUTATION_FILTERS = {
    Gold: { color: 'rgb(235,200,0)', alpha: 0.7 },
    Rainbow: {
      colors: ['#FF1744', '#FF9100', '#FFEA00', '#00E676', '#2979FF', '#D500F9'],
      alpha: 0.85,
      angle: 130,
    },
  };

  const SHOP_CATEGORY_HINTS = {
    seed: ['seed', 'seeds', 'crop', 'plant'],
    tool: ['tool', 'tools'],
    egg: ['egg', 'eggs'],
    decor: ['decor', 'decors', 'decoration'],
    pet: ['pet', 'pets', 'animal', 'animals'],
    ui: ['ui', 'weather', 'icon'],
  };

  const normalizeToken = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const normalizeMutation = (value) => {
    if (!value) return '';
    let text = '';
    if (Array.isArray(value)) {
      text = value.map((entry) => String(entry || '')).join(' ');
    } else {
      text = String(value);
    }
    const lower = text.toLowerCase();
    if (lower.includes('rainbow')) return 'Rainbow';
    if (lower.includes('gold')) return 'Gold';
    return '';
  };

  const splitTokens = (value) => {
    const spaced = String(value || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .toLowerCase();
    if (!spaced) return [];
    return spaced.split(/\s+/).filter(Boolean);
  };

  const jaroWinkler = (a, b) => {
    if (a === b) return 1;
    const s1 = String(a || '');
    const s2 = String(b || '');
    const len1 = s1.length;
    const len2 = s2.length;
    if (!len1 || !len2) return 0;

    const matchDistance = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);

    let matches = 0;
    for (let i = 0; i < len1; i += 1) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, len2);
      for (let j = start; j < end; j += 1) {
        if (s2Matches[j]) continue;
        if (s1[i] !== s2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches += 1;
        break;
      }
    }

    if (!matches) return 0;

    let t = 0;
    let k = 0;
    for (let i = 0; i < len1; i += 1) {
      if (!s1Matches[i]) continue;
      while (k < len2 && !s2Matches[k]) k += 1;
      if (k < len2 && s1[i] !== s2[k]) t += 1;
      k += 1;
    }

    const transpositions = t / 2;
    const jaro =
      (matches / len1 +
        matches / len2 +
        (matches - transpositions) / matches) /
      3;

    let prefix = 0;
    const prefixLimit = Math.min(4, len1, len2);
    for (let i = 0; i < prefixLimit; i += 1) {
      if (s1[i] === s2[i]) {
        prefix += 1;
      } else {
        break;
      }
    }

    return jaro + prefix * 0.1 * (1 - jaro);
  };

  const getFuzzyThreshold = (value) => {
    const len = value.length;
    if (len <= 4) return 0.94;
    if (len <= 6) return 0.9;
    if (len <= 9) return 0.88;
    return 0.85;
  };

  const normalizePath = (value) => String(value || '').replace(/\\/g, '/');

  const resolveRelativePath = (fromPath, relativePath) => {
    const rel = normalizePath(relativePath);
    if (!rel) return rel;
    if (rel.startsWith('/')) return rel.replace(/^\/+/, '');

    const base = normalizePath(fromPath);
    const parts = base.split('/');
    parts.pop();

    const relParts = rel.split('/');
    const stack = [];

    for (const part of parts.concat(relParts)) {
      if (!part || part === '.') continue;
      if (part === '..') {
        stack.pop();
      } else {
        stack.push(part);
      }
    }

    return stack.join('/');
  };

  const SUPPORTED_BLEND_OPS = (() => {
    try {
      const c = document.createElement('canvas');
      const g = c.getContext('2d');
      if (!g) return new Set();
      const ops = [
        'color',
        'hue',
        'saturation',
        'luminosity',
        'overlay',
        'screen',
        'lighter',
        'source-atop',
      ];
      const ok = new Set();
      for (const op of ops) {
        g.globalCompositeOperation = op;
        if (g.globalCompositeOperation === op) ok.add(op);
      }
      return ok;
    } catch {
      return new Set();
    }
  })();

  const pickBlendOp = (desired) => {
    if (SUPPORTED_BLEND_OPS.has(desired)) return desired;
    if (SUPPORTED_BLEND_OPS.has('overlay')) return 'overlay';
    if (SUPPORTED_BLEND_OPS.has('screen')) return 'screen';
    if (SUPPORTED_BLEND_OPS.has('lighter')) return 'lighter';
    return 'source-atop';
  };

  const angleGrad = (ctx, width, height, angle, fullSpan = false) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    const cx = width / 2;
    const cy = height / 2;

    if (!fullSpan) {
      const r = Math.min(width, height) / 2;
      return ctx.createLinearGradient(
        cx - Math.cos(rad) * r,
        cy - Math.sin(rad) * r,
        cx + Math.cos(rad) * r,
        cy + Math.sin(rad) * r,
      );
    }

    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const r = (Math.abs(dx) * width) / 2 + (Math.abs(dy) * height) / 2;
    return ctx.createLinearGradient(cx - dx * r, cy - dy * r, cx + dx * r, cy + dy * r);
  };

  const fillGradient = (ctx, width, height, def, fullSpan = false) => {
    const colors = def.colors?.length ? def.colors : ['#fff'];
    const grad =
      def.angle != null
        ? angleGrad(ctx, width, height, def.angle, fullSpan)
        : ctx.createLinearGradient(0, 0, 0, height);
    if (colors.length === 1) {
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(1, colors[0]);
    } else {
      colors.forEach((color, idx) => {
        grad.addColorStop(idx / (colors.length - 1), color);
      });
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  };

  const applyMutation = (ctx, width, height, mutation) => {
    const def = MUTATION_FILTERS[mutation];
    if (!def) return;
    ctx.save();
    if (mutation === 'Rainbow') {
      const blendOp = pickBlendOp('color');
      ctx.globalCompositeOperation = blendOp;
      const mask = document.createElement('canvas');
      mask.width = width;
      mask.height = height;
      const mctx = mask.getContext('2d');
      if (mctx) {
        mctx.imageSmoothingEnabled = false;
        fillGradient(mctx, width, height, def, false);
        mctx.globalCompositeOperation = 'destination-in';
        mctx.drawImage(ctx.canvas, 0, 0);
        ctx.drawImage(mask, 0, 0);
      }
    } else {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = def.alpha ?? 1;
      ctx.fillStyle = def.color;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  };

  const parseSpriteKey = (key) => {
    const clean = normalizePath(key);
    const parts = clean.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    if (parts[0] !== 'sprite' && parts[0] !== 'sprites') return null;

    if (parts.length === 2) {
      return { category: 'misc', name: parts[1] };
    }

    return {
      category: parts[1],
      name: parts.slice(2).join('/'),
    };
  };

  const addEntry = (map, key, entry) => {
    if (!map.has(key)) {
      map.set(key, [entry]);
      return;
    }
    map.get(key).push(entry);
  };

  const buildSpriteIndex = (atlases) => {
    spriteIndex.entries.clear();
    spriteIndex.byCategory.clear();
    spriteIndex.byName.clear();

    for (const [atlasPath, atlas] of atlases) {
      const imagePath = resolveRelativePath(atlasPath, atlas.meta.image);

      for (const [key, frameData] of Object.entries(atlas.frames || {})) {
        const parsed = parseSpriteKey(key);
        if (!parsed) continue;
        if (parsed.category.startsWith('mutation')) continue;

        const entry = {
          key,
          category: parsed.category,
          name: parsed.name,
          atlasPath,
          imagePath,
          frameData,
        };

        spriteIndex.entries.set(key, entry);

        const categoryKey = normalizeToken(parsed.category);
        const nameKey = normalizeToken(parsed.name);

        if (!spriteIndex.byCategory.has(categoryKey)) {
          spriteIndex.byCategory.set(categoryKey, new Map());
        }

        const categoryMap = spriteIndex.byCategory.get(categoryKey);
        if (!categoryMap.has(nameKey)) {
          categoryMap.set(nameKey, entry);
        }

        if (nameKey) {
          addEntry(spriteIndex.byName, nameKey, entry);
        }
      }
    }

    spriteIndex.ready = true;
  };

  const isAtlas = (json) =>
    Boolean(
      json &&
        typeof json === 'object' &&
        json.frames &&
        json.meta &&
        typeof json.meta.image === 'string',
    );

  const loadSpriteIndex = async () => {
    if (indexPromise) return indexPromise;

    indexPromise = (async () => {
      const manifest = await window.api.assetsManifest();
      const bundles = Array.isArray(manifest?.bundles) ? manifest.bundles : [];
      const defaultBundle = bundles.find((bundle) => bundle.name === 'default');

      if (!defaultBundle) {
        throw new Error('Default bundle not found');
      }

      const jsonPaths = new Set();
      for (const asset of defaultBundle.assets || []) {
        for (const src of asset.src || []) {
          if (typeof src === 'string' && src.endsWith('.json') && src !== 'manifest.json') {
            jsonPaths.add(src);
          }
        }
      }

      const atlases = new Map();
      const pending = Array.from(jsonPaths);
      const seen = new Set();

      while (pending.length) {
        const atlasPath = pending.pop();
        if (!atlasPath || seen.has(atlasPath)) continue;
        seen.add(atlasPath);

        const atlas = await window.api.assetsJson(atlasPath);
        if (!isAtlas(atlas)) continue;
        atlases.set(atlasPath, atlas);

        const related = atlas.meta?.related_multi_packs;
        if (Array.isArray(related)) {
          for (const rel of related) {
            const relPath = resolveRelativePath(atlasPath, rel);
            if (relPath && !seen.has(relPath)) {
              pending.push(relPath);
            }
          }
        }
      }

      buildSpriteIndex(atlases);
      return true;
    })().catch(() => {
      spriteIndex.ready = false;
      indexPromise = null;
      return false;
    });

    return indexPromise;
  };

  const pickTokenMatch = (categoryMap, tokens) => {
    if (!categoryMap || !tokens.length) return null;
    const last = tokens[tokens.length - 1];
    if (last && categoryMap.has(last)) {
      return categoryMap.get(last);
    }
    const sorted = [...tokens].sort((a, b) => b.length - a.length);
    for (const token of sorted) {
      if (token.length < 4) continue;
      if (categoryMap.has(token)) {
        return categoryMap.get(token);
      }
    }
    return null;
  };

  const pickPartialMatch = (categoryMap, nameKey) => {
    if (!categoryMap || !nameKey) return null;
    let best = null;
    let bestLen = 0;
    for (const [candidateKey, entry] of categoryMap.entries()) {
      if (!candidateKey) continue;
      if (candidateKey.length <= bestLen) continue;
      if (
        nameKey.endsWith(candidateKey) ||
        candidateKey.endsWith(nameKey) ||
        nameKey.startsWith(candidateKey) ||
        candidateKey.startsWith(nameKey) ||
        nameKey.includes(candidateKey) ||
        candidateKey.includes(nameKey)
      ) {
        best = entry;
        bestLen = candidateKey.length;
      }
    }
    if (best) return best;
    return null;
  };

  const pickFuzzyMatch = (categoryMap, nameKey) => {
    if (!categoryMap || !nameKey) return null;
    const threshold = getFuzzyThreshold(nameKey);
    let best = null;
    let bestScore = 0;
    for (const [candidateKey, entry] of categoryMap.entries()) {
      if (!candidateKey) continue;
      const diff = Math.abs(candidateKey.length - nameKey.length);
      if (diff > Math.max(6, Math.floor(nameKey.length * 0.7))) continue;
      const score = jaroWinkler(nameKey, candidateKey);
      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    }
    if (bestScore >= threshold) return best;
    return null;
  };

  const pickFuzzyGlobal = (nameKey) => {
    if (!nameKey) return null;
    const threshold = getFuzzyThreshold(nameKey);
    let best = null;
    let bestScore = 0;
    for (const [candidateKey, entries] of spriteIndex.byName.entries()) {
      if (!candidateKey) continue;
      const diff = Math.abs(candidateKey.length - nameKey.length);
      if (diff > Math.max(6, Math.floor(nameKey.length * 0.7))) continue;
      const score = jaroWinkler(nameKey, candidateKey);
      if (score > bestScore) {
        bestScore = score;
        best = Array.isArray(entries) ? entries[0] : entries;
      }
    }
    if (bestScore >= threshold) return best;
    return null;
  };

  const resolveEntry = (shop, itemName) => {
    const nameKey = normalizeToken(itemName);
    if (!nameKey) return null;
    const tokens = splitTokens(itemName);
    const hints = SHOP_CATEGORY_HINTS[shop] || [];

    for (const hint of hints) {
      const hintKey = normalizeToken(hint);
      const categoryMap = spriteIndex.byCategory.get(hintKey);
      if (categoryMap && categoryMap.has(nameKey)) {
        return categoryMap.get(nameKey);
      }
      const tokenMatch = pickTokenMatch(categoryMap, tokens);
      if (tokenMatch) return tokenMatch;
      const partialMatch = pickPartialMatch(categoryMap, nameKey);
      if (partialMatch) return partialMatch;
      const fuzzyMatch = pickFuzzyMatch(categoryMap, nameKey);
      if (fuzzyMatch) return fuzzyMatch;
    }

    const candidates = spriteIndex.byName.get(nameKey);
    if (!candidates || candidates.length === 0) {
      for (const token of tokens) {
        if (token.length < 4) continue;
        const fallback = spriteIndex.byName.get(token);
        if (fallback && fallback.length) return fallback[0];
      }
      if (tokens.length) {
        const last = tokens[tokens.length - 1];
        if (last && last.length >= 4) {
          const fuzzyToken = pickFuzzyGlobal(last);
          if (fuzzyToken) return fuzzyToken;
        }
      }
      const fuzzyGlobal = pickFuzzyGlobal(nameKey);
      if (fuzzyGlobal) return fuzzyGlobal;
      return null;
    }
    if (candidates.length === 1) return candidates[0];

    const shopKey = normalizeToken(shop);
    if (shopKey) {
      const match = candidates.find((entry) =>
        normalizeToken(entry.category).includes(shopKey),
      );
      if (match) return match;
    }

    return candidates[0];
  };

  const loadImage = async (imagePath) => {
    if (imageCache.has(imagePath)) {
      return imageCache.get(imagePath);
    }

    const promise = (async () => {
      const payload = await window.api.assetsImage(imagePath);
      if (!payload?.dataUrl) {
        throw new Error('Image not found');
      }

      const img = new Image();
      img.decoding = 'async';
      const loaded = new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed'));
      });
      img.src = payload.dataUrl;
      return loaded;
    })();

    imageCache.set(imagePath, promise);
    return promise;
  };

  const drawSprite = (entry, img, size, mutation) => {
    const frameData = entry.frameData;
    const frame = frameData.frame || frameData;
    const rotated = Boolean(frameData.rotated);
    const spriteSource = frameData.spriteSourceSize || {
      x: 0,
      y: 0,
      w: frame.w,
      h: frame.h,
    };
    const sourceSize = frameData.sourceSize || { w: frame.w, h: frame.h };

    const spriteW = spriteSource.w || frame.w;
    const spriteH = spriteSource.h || frame.h;
    const srcW = rotated ? frame.h : frame.w;
    const srcH = rotated ? frame.w : frame.h;

    const outW = Math.max(1, sourceSize.w || spriteW);
    const outH = Math.max(1, sourceSize.h || spriteH);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.round(outW);
    tempCanvas.height = Math.round(outH);

    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    ctx.imageSmoothingEnabled = false;

    const offsetX = spriteSource.x || 0;
    const offsetY = spriteSource.y || 0;

    if (rotated) {
      const drawW = spriteH;
      const drawH = spriteW;

      ctx.save();
      ctx.translate(offsetX + spriteW / 2, offsetY + spriteH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(
        img,
        frame.x,
        frame.y,
        srcW,
        srcH,
        -drawW / 2,
        -drawH / 2,
        drawW,
        drawH,
      );
      ctx.restore();
    } else {
      ctx.drawImage(
        img,
        frame.x,
        frame.y,
        srcW,
        srcH,
        offsetX,
        offsetY,
        spriteW,
        spriteH,
      );
    }

    applyMutation(ctx, tempCanvas.width, tempCanvas.height, mutation);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = size;
    outputCanvas.height = size;

    const outCtx = outputCanvas.getContext('2d');
    if (!outCtx) return null;
    outCtx.clearRect(0, 0, size, size);
    outCtx.imageSmoothingEnabled = true;

    const scale = Math.min(size / tempCanvas.width, size / tempCanvas.height);
    const drawW = Math.max(1, Math.round(tempCanvas.width * scale));
    const drawH = Math.max(1, Math.round(tempCanvas.height * scale));
    const dx = Math.round((size - drawW) / 2);
    const dy = Math.round((size - drawH) / 2);

    outCtx.drawImage(
      tempCanvas,
      0,
      0,
      tempCanvas.width,
      tempCanvas.height,
      dx,
      dy,
      drawW,
      drawH,
    );

    return outputCanvas.toDataURL('image/png');
  };

  const getIcon = async ({ shop, item, size = 16, mutation } = {}) => {
    await loadSpriteIndex();
    const entry = resolveEntry(shop, item);
    if (!entry) return null;

    const mutationKey = normalizeMutation(mutation);
    const cacheKey = `${entry.key}|${size}|${mutationKey || 'none'}`;
    if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);
    if (pendingIcons.has(cacheKey)) return pendingIcons.get(cacheKey);

    const promise = (async () => {
      const img = await loadImage(entry.imagePath);
      const dataUrl = drawSprite(entry, img, size, mutationKey);
      if (dataUrl) {
        iconCache.set(cacheKey, dataUrl);
      }
      return dataUrl;
    })().catch(() => null);

    pendingIcons.set(cacheKey, promise);
    const result = await promise;
    pendingIcons.delete(cacheKey);
    return result;
  };

  window.spriteResolver = {
    getIcon,
    preload: () => loadSpriteIndex().catch(() => null),
    isReady: () => spriteIndex.ready,
  };
})();
