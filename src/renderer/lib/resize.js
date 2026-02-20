import { appRoot, mainView } from './dom.js';
import { syncLogHeight, scheduleLogRender } from './logs.js';

let lastSize = { width: 0, height: 0 };
let lastMainSize = null;

export const getLastMainSize = () => lastMainSize;
export const setLastMainSize = (value) => { lastMainSize = value; };
export const getLastSize = () => lastSize;

const requestResize = () => {
  if (!appRoot || !window.api?.resizeTo) return;
  const rect = appRoot.getBoundingClientRect();
  const width = Math.ceil(rect.width + 8);
  const height = Math.ceil(rect.height + 8);
  if (
    mainView &&
    !mainView.classList.contains('hidden') &&
    window.matchMedia('(min-width: 861px)').matches
  ) {
    lastMainSize = { width, height };
  }
  if (Math.abs(width - lastSize.width) < 2 && Math.abs(height - lastSize.height) < 2) {
    return;
  }
  lastSize = { width, height };
  window.api.resizeTo({ width, height });
};

export const scheduleResize = (() => {
  let frame = null;
  return () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      syncLogHeight();
      scheduleLogRender();
      requestResize();
    });
  };
})();
