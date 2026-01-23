'use strict';

const buildUrl = ({ host, version, room, playerId }) => {
  const u = new URL(`wss://${host}/version/${version}/api/rooms/${room}/connect`);
  u.searchParams.set('surface', '"web"');
  u.searchParams.set('platform', '"desktop"');
  u.searchParams.set('playerId', JSON.stringify(playerId));
  u.searchParams.set('version', JSON.stringify(version));
  u.searchParams.set('source', '"manualUrl"');
  u.searchParams.set('capabilities', '"fbo_mipmap_ok"');
  return u.toString();
};

module.exports = { buildUrl };
