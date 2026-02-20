import { sessions, activeSessionId } from './state.js';
import { buildTrayPets } from './pets.js';

export const syncTraySession = (session) => {
  if (!session || !window.api?.setTraySession) return;
  window.api.setTraySession({
    id: session.id,
    name: session.name,
    connected: Boolean(session.connected),
    room: session.room || '',
    roomId: session.roomId || '',
    gameUrl: session.gameUrl || '',
    pets: buildTrayPets(session),
  });
};

export const syncAllTraySessions = () => {
  sessions.forEach((session) => syncTraySession(session));
  if (window.api?.setActiveSession) {
    window.api.setActiveSession({ sessionId: activeSessionId.value });
  }
};
