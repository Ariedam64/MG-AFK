(() => {
  const pad = (n) => String(n).padStart(2, '0');
  const formatRestock = (seconds) => {
    if (!Number.isFinite(seconds)) return '--:--';
    const safe = Math.max(0, Math.floor(seconds));
    const mm = Math.floor(safe / 60);
    const ss = safe % 60;
    return `${pad(mm)}:${pad(ss)}`;
  };

  const renderList = (container, items, emptyText) => {
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

      const name = document.createElement('span');
      name.className = 'label';
      name.textContent = item.name || '-';

      const stock = document.createElement('span');
      stock.className = 'value';
      stock.textContent = String(item.stock ?? 0);

      row.appendChild(name);
      row.appendChild(stock);
      container.appendChild(row);
    });
  };

  const renderShop = (slot, items, restock, emptyText) => {
    if (!slot) return;
    renderList(slot.list, items, emptyText);
    if (slot.restock) slot.restock.textContent = formatRestock(restock);
  };

  const renderShops = (containers, payload) => {
    if (!payload || !containers) return;
    const restock = payload.restock || {};
    renderShop(containers.seed, payload.seed, restock.seed, 'No seeds');
    renderShop(containers.tool, payload.tool, restock.tool, 'No tools');
    renderShop(containers.egg, payload.egg, restock.egg, 'No eggs');
    renderShop(containers.decor, payload.decor, restock.decor, 'No decor');
  };

  window.shopsView = {
    renderShops,
  };
})();
