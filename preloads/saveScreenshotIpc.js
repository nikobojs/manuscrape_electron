const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  quickScreenshot: (...args) => {
    ipcRenderer.send('quick-screenshot', ...args);
  }
})
