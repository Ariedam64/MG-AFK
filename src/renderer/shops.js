(() => {
  const pad = (n) => String(n).padStart(2, '0');
  const formatRestock = (seconds) => {
    if (!Number.isFinite(seconds)) return '--:--';
    const safe = Math.max(0, Math.floor(seconds));
    const mm = Math.floor(safe / 60);
    const ss = safe % 60;
    return `${pad(mm)}:${pad(ss)}`;
  };

  const renderList = (container, items, emptyText, shopKey) => {
    if (!container) return;
    container.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'shop-empty';
      empty.textContent = emptyText || 'Empty';
      container.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'shop-item';

      const labelWrap = document.createElement('span');
      labelWrap.className = 'item-label';

      const icon = document.createElement('img');
      icon.className = 'item-sprite sprite-placeholder';
      icon.alt = '';
      icon.loading = 'lazy';
      icon.decoding = 'async';

      const name = document.createElement('span');
      name.className = 'label';
      name.textContent = item.name || '-';

      labelWrap.appendChild(icon);
      labelWrap.appendChild(name);

      const stock = document.createElement('span');
      stock.className = 'value';
      stock.textContent = String(item.stock ?? 0);

      row.appendChild(labelWrap);
      row.appendChild(stock);
      container.appendChild(row);

      if (window.spriteResolver?.getIcon && item.name) {
        const request = window.spriteResolver.getIcon({
          shop: shopKey,
          item: item.name,
          size: 16,
        });
        if (request && typeof request.then === 'function') {
          request
            .then((url) => {
              if (!url) return;
              icon.src = url;
              icon.classList.remove('sprite-placeholder');
            })
            .catch(() => {});
        }
      }
    });
  };

  const renderShop = (slot, items, restock, emptyText, shopKey) => {
    if (!slot) return;
    renderList(slot.list, items, emptyText, shopKey);
    if (slot.restock) slot.restock.textContent = formatRestock(restock);
  };

  const renderShops = (containers, payload) => {
    if (!payload || !containers) return;
    const restock = payload.restock || {};
    renderShop(containers.seed, payload.seed, restock.seed, 'No seeds', 'seed');
    renderShop(containers.tool, payload.tool, restock.tool, 'No tools', 'tool');
    renderShop(containers.egg, payload.egg, restock.egg, 'No eggs', 'egg');
    renderShop(containers.decor, payload.decor, restock.decor, 'No decor', 'decor');
  };

  window.shopsView = {
    renderShops,
  };
})();
