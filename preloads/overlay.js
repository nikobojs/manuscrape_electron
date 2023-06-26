const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  quickScreenshot: (...args) => {
    ipcRenderer.send('quick-screenshot', ...args);
  },
  scrollScreenshot: (...args) => {
    ipcRenderer.send('scroll-screenshot', ...args);
  },
})
