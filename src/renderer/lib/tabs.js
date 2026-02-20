import { tabs, addTabBtn } from './dom.js';
import { sessions, activeSessionId } from './state.js';
import { removeSession, setActiveSession } from './sessions.js';

export const renderTabs = () => {
  if (!tabs) return;
  tabs.innerHTML = '';
  sessions.forEach((session) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `tab${session.id === activeSessionId.value ? ' active' : ''}`;
    tab.dataset.sessionId = session.id;

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = session.name;
    tab.appendChild(label);

    if (sessions.length > 1) {
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'tab-close';
      closeBtn.textContent = 'x';
      closeBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        await removeSession(session.id);
      });
      tab.appendChild(closeBtn);
    }

    tab.addEventListener('click', () => {
      if (label.isContentEditable) return;
      setActiveSession(session.id);
    });

    tabs.appendChild(tab);
  });
  if (addTabBtn) {
    tabs.appendChild(addTabBtn);
  }
};
