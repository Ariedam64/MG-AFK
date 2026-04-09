(() => {
  const DATA_URL = 'https://mg-api.ariedam.fr/data';

  const spriteByName = new Map();
  let dataPromise = null;
  let ready = false;

  const normalize = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const register = (name, sprite) => {
    if (!name || !sprite) return;
    const key = normalize(name);
    if (key && !spriteByName.has(key)) {
      spriteByName.set(key, sprite);
    }
  };

  const loadData = async () => {
    if (dataPromise) return dataPromise;

    dataPromise = (async () => {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error(`data fetch failed: ${res.status}`);
      const data = await res.json();

      for (const [plantKey, plant] of Object.entries(data.plants || {})) {
        const seed = plant.seed;
        if (seed?.sprite) {
          register(seed.name, seed.sprite);
          register(plantKey + 'Seed', seed.sprite);
          register(plantKey, seed.sprite);
        }
      }

      for (const [key, entry] of Object.entries(data.pets || {})) {
        register(entry.name, entry.sprite);
        register(key, entry.sprite);
      }

      for (const [key, entry] of Object.entries(data.items || {})) {
        register(entry.name, entry.sprite);
        register(key, entry.sprite);
      }

      for (const [key, entry] of Object.entries(data.decor || {})) {
        register(entry.name, entry.sprite);
        register(key, entry.sprite);
      }

      for (const [key, entry] of Object.entries(data.eggs || {})) {
        register(entry.name, entry.sprite);
        register(key, entry.sprite);
      }

      for (const [key, entry] of Object.entries(data.weathers || {})) {
        register(entry.name, entry.sprite);
        register(key, entry.sprite);
      }

      ready = true;
    })().catch(() => {
      ready = false;
      dataPromise = null;
    });

    return dataPromise;
  };

  const getIcon = async ({ shop, item } = {}) => {
    if (!item) return null;
    await loadData();
    return spriteByName.get(normalize(item)) || null;
  };

  window.spriteResolver = {
    getIcon,
    preload: () => loadData().catch(() => null),
    isReady: () => ready,
  };
})();
