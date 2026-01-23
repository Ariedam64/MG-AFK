'use strict';

const extractShopItems = (shop, key) => {
  const inventory = Array.isArray(shop?.inventory) ? shop.inventory : [];
  return inventory
    .filter((item) => item && Number(item.initialStock) > 0)
    .map((item) => ({
      name: item[key],
      stock: item.initialStock,
    }))
    .filter((item) => item.name);
};

const extractShopCatalog = (shop, key) => {
  const inventory = Array.isArray(shop?.inventory) ? shop.inventory : [];
  return inventory
    .map((item) => ({
      name: item?.[key],
      stock: item?.initialStock ?? 0,
    }))
    .filter((item) => item.name);
};

module.exports = { extractShopItems, extractShopCatalog };
