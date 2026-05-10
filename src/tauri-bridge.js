import { invoke } from '@tauri-apps/api/core';

function _isTauri() {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__;
}

async function _minimize() {
  if (!_isTauri()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  getCurrentWindow().minimize();
}

async function _maximize() {
  if (!_isTauri()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  getCurrentWindow().toggleMaximize();
}

async function _close() {
  if (!_isTauri()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  getCurrentWindow().close();
}

export const electronAPI = {
  minimize: () => { _minimize(); },
  maximize: () => { _maximize(); },
  close: () => { _close(); },
  saveFile: (args) => {
    if (!_isTauri()) return Promise.resolve({ success: false });
    return invoke('save_file', args);
  },
  openFile: (args) => {
    if (!_isTauri()) return Promise.resolve({ success: false });
    return invoke('open_file', args);
  },
  saveFilesToFolder: (args) => {
    if (!_isTauri()) return Promise.resolve({ success: false });
    return invoke('save_files_to_folder', args);
  },
};
