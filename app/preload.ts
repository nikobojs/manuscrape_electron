import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld('electronAPI', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  areaMarked: (...args: any) => {
    ipcRenderer.send('area-marked', ...args);
  },
  signIn: (signInBody: ISignInBody, callback: SignInCallback, callbackError: SignInCallback) => {
    ipcRenderer.once('sign-in-ok', callback)
    ipcRenderer.once('sign-in-error', callbackError)
    ipcRenderer.send('sign-in', signInBody);
  },
})
