'use strict';

const findUserSlotIndex = (room, game, playerId, playerIndex) => {
  const slots = game?.userSlots;
  if (!Array.isArray(slots)) return null;

  const dbId = room?.players?.find((p) => p?.id === playerId)?.databaseUserId;
  const matchesPlayer = (slot) =>
    slot &&
    (slot.playerId === playerId ||
      slot?.data?.playerId === playerId);
  const matchesDb = (slot) =>
    dbId &&
    slot &&
    (slot?.data?.databaseUserId === dbId || slot?.data?.userId === dbId);

  if (typeof playerIndex === 'number' && playerIndex >= 0) {
    const slot = slots[playerIndex];
    if (slot && matchesPlayer(slot)) {
      return playerIndex;
    }
  }

  const byPlayerId = slots.findIndex((slot) => matchesPlayer(slot));
  if (byPlayerId >= 0) return byPlayerId;

  if (dbId) {
    const byDb = slots.findIndex((slot) => matchesDb(slot));
    if (byDb >= 0) return byDb;
  }

  return null;
};

const pickUserSlot = (room, game, playerId, playerIndex) => {
  const slots = game?.userSlots;
  if (!Array.isArray(slots)) return null;
  const idx = findUserSlotIndex(room, game, playerId, playerIndex);
  if (idx == null) return null;
  return slots[idx] || null;
};

const slimPlayer = (player) => {
  if (!player || typeof player !== 'object') return null;
  return {
    id: player.id || '',
    name: player.name || '',
    isConnected: Boolean(player.isConnected),
    databaseUserId:
      player.databaseUserId !== undefined ? player.databaseUserId : null,
  };
};

const slimUserSlotData = (data) => {
  if (!data || typeof data !== 'object') return {};
  return {
    playerId: data.playerId || null,
    databaseUserId: data.databaseUserId ?? null,
    userId: data.userId ?? null,
    id: data.id ?? null,
    petSlots: Array.isArray(data.petSlots) ? data.petSlots : [],
    activityLogs: Array.isArray(data.activityLogs) ? data.activityLogs : [],
  };
};

const slimUserSlot = (slot) => {
  if (!slot || typeof slot !== 'object') return null;
  const data = slimUserSlotData(slot.data);
  return {
    playerId: slot.playerId || data.playerId || data.id || null,
    data,
  };
};

const slimShop = (shop) => ({
  inventory: Array.isArray(shop?.inventory) ? shop.inventory : [],
  secondsUntilRestock:
    shop?.secondsUntilRestock !== undefined ? shop.secondsUntilRestock : null,
});

const slimShops = (shops) => ({
  seed: slimShop(shops?.seed),
  tool: slimShop(shops?.tool),
  egg: slimShop(shops?.egg),
  decor: slimShop(shops?.decor),
});

const pickRoomState = (room) => ({
  roomId: room?.roomId || '',
  roomSessionId: room?.roomSessionId || '',
  hostPlayerId: room?.hostPlayerId || '',
  players: Array.isArray(room?.players)
    ? room.players.map((player) => slimPlayer(player)).filter(Boolean)
    : [],
});

const pickGameState = (game) => ({
  userSlots: Array.isArray(game?.userSlots)
    ? game.userSlots.map((slot) => (slot ? slimUserSlot(slot) : null))
    : [],
  shops: slimShops(game?.shops),
  weather: game?.weather ?? null,
});

module.exports = {
  findUserSlotIndex,
  pickUserSlot,
  slimPlayer,
  slimUserSlotData,
  slimUserSlot,
  slimShop,
  slimShops,
  pickRoomState,
  pickGameState,
};
