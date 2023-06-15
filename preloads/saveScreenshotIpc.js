const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveScreenshot: (a, b, c) => {
    console.log('SAVE SCREEN SHOT PRELOAD WAS CALLED!')
    ipcRenderer.send('save-screenshot', a, b, c)
  }
})
