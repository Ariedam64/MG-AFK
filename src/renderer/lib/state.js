export const sessions = [];

export const activeSessionId = { value: '' };

export const getActiveSession = () =>
  sessions.find((session) => session.id === activeSessionId.value);

export const getSessionById = (id) =>
  sessions.find((session) => session.id === id);
