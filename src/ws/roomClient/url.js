'use strict';

// Mirrors the official web client's handshake query params
// (see RoomConnection in the game's client bundle):
// surface, platform, version, capabilities, locale, clientDocumentId,
// clientConnectionAttempt, clientNavigationType, clientVisibilityState.
// playerId is MG AFK's own hint for self-identification; the server assigns
// the authoritative id and reports it back as Welcome.selfPlayerId.
const buildUrl = ({
  host,
  version,
  room,
  playerId,
  clientDocumentId,
  clientConnectionAttempt,
  clientNavigationType,
  clientVisibilityState,
  locale,
  capabilities,
}) => {
  const u = new URL(`wss://${host}/version/${version}/api/rooms/${room}/connect`);
  u.searchParams.set('surface', '"web"');
  u.searchParams.set('platform', '"desktop"');
  u.searchParams.set('version', JSON.stringify(version));
  u.searchParams.set('capabilities', JSON.stringify(capabilities));
  u.searchParams.set('locale', JSON.stringify(locale));
  if (clientDocumentId) {
    u.searchParams.set('clientDocumentId', JSON.stringify(clientDocumentId));
  }
  if (Number.isFinite(clientConnectionAttempt)) {
    u.searchParams.set('clientConnectionAttempt', JSON.stringify(clientConnectionAttempt));
  }
  if (clientNavigationType) {
    u.searchParams.set('clientNavigationType', JSON.stringify(clientNavigationType));
  }
  if (clientVisibilityState) {
    u.searchParams.set('clientVisibilityState', JSON.stringify(clientVisibilityState));
  }
  if (playerId) {
    u.searchParams.set('playerId', JSON.stringify(playerId));
  }
  return u.toString();
};

module.exports = { buildUrl };
