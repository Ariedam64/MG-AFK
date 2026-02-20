import { statusChip, updateStatus } from './dom.js';

export const setStatusChip = (state) => {
  statusChip.classList.remove('chip-idle', 'chip-online', 'chip-connecting', 'chip-error');
  if (state === 'connected') {
    statusChip.textContent = 'Online';
    statusChip.classList.add('chip-online');
    return;
  }
  if (state === 'connecting') {
    statusChip.textContent = 'Connecting...';
    statusChip.classList.add('chip-connecting');
    return;
  }
  if (state === 'error') {
    statusChip.textContent = 'Error';
    statusChip.classList.add('chip-error');
    return;
  }
  statusChip.textContent = 'Offline';
  statusChip.classList.add('chip-idle');
};

export const setUpdateStatus = (msg) => {
  if (updateStatus) updateStatus.textContent = msg ? String(msg) : '';
};

export const setTrayUpdateStatus = (msg) => {
  if (!window.api?.setTrayUpdateStatus) return;
  window.api.setTrayUpdateStatus({ text: msg ? String(msg) : '' });
};
