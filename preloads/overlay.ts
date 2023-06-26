const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  // quickScreenshot: (...args: any) => {
  //   ipcRenderer.send('quick-screenshot', ...args);
  // },
  // scrollScreenshot: (...args: any) => {
  //   ipcRenderer.send('scroll-screenshot', ...args);
  // },
  areaMarked: (...args: any) => {
    ipcRenderer.send('area-marked', ...args);
  },
})
