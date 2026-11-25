const { contextBridge, ipcRenderer } = require('electron');

const UPDATER_LISTENER_CHANNELS = new Set([
  'updater:available',
  'updater:progress',
  'updater:error',
]);

function listenToUpdater(channel, listener) {
  if (!UPDATER_LISTENER_CHANNELS.has(channel) || typeof listener !== 'function') {
    return () => {};
  }
  const wrapped = (_event, payload) => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

// Tells the web app whether page images are installed (asked once, synchronously, before the app starts).
contextBridge.exposeInMainWorld('quranApp', {
  pages: ipcRenderer.sendSync('pages:available'),
  insertFootnote: (payload) => ipcRenderer.invoke('footnote:insert', payload),
  updater: {
    onAvailable: (listener) => listenToUpdater('updater:available', listener),
    onProgress: (listener) => listenToUpdater('updater:progress', listener),
    onError: (listener) => listenToUpdater('updater:error', listener),
    respond: (accepted) => ipcRenderer.invoke('updater:respond', accepted),
  },
});
