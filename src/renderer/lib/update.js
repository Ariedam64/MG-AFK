import { checkUpdateBtn, openUpdateBtn } from './dom.js';
import { setUpdateStatus, setTrayUpdateStatus } from './status.js';

export const runUpdateCheck = async ({ showProgress = false } = {}) => {
  if (!window.api?.checkUpdate) return;
  if (showProgress && checkUpdateBtn) checkUpdateBtn.disabled = true;
  if (showProgress) setUpdateStatus('Checking...');
  if (showProgress) setTrayUpdateStatus('Checking...');
  if (openUpdateBtn) {
    openUpdateBtn.classList.add('hidden');
    openUpdateBtn.textContent = 'Download';
  }
  try {
    const result = await window.api.checkUpdate();
    if (!result || result.status === 'error') {
      if (showProgress) {
        const msg = result?.message || 'Update check failed.';
        setUpdateStatus(msg);
        setTrayUpdateStatus(msg);
      }
      return;
    }
    if (result.status === 'no-release') {
      setUpdateStatus('No releases yet.');
      setTrayUpdateStatus('No releases yet.');
      if (openUpdateBtn && result.url) {
        openUpdateBtn.dataset.url = result.url;
        openUpdateBtn.textContent = 'Open releases';
        openUpdateBtn.classList.remove('hidden');
      }
      return;
    }
    if (result.status === 'available') {
      const msg = `Update available (${result.latestVersion})`;
      setUpdateStatus(msg);
      setTrayUpdateStatus(msg);
      if (openUpdateBtn && result.url) {
        openUpdateBtn.dataset.url = result.url;
        openUpdateBtn.textContent = 'Download';
        openUpdateBtn.classList.remove('hidden');
      }
      return;
    }
    setUpdateStatus('Up to date');
    setTrayUpdateStatus('Up to date');
  } catch (err) {
    if (showProgress) {
      const msg = err && err.message ? err.message : 'Update check failed.';
      setUpdateStatus(msg);
      setTrayUpdateStatus(msg);
    }
  } finally {
    if (showProgress && checkUpdateBtn) checkUpdateBtn.disabled = false;
  }
};
