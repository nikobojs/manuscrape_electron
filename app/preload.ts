import { contextBridge, ipcRenderer, ipcMain, type IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld('electronAPI', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  projectCreated: (project: any) => {
    ipcRenderer.send('project-created', project)
  },
  observationCreated: (project: any) => {
    ipcRenderer.send('observation-created', project)
  },
  areaMarked: (...args: any) => {
    ipcRenderer.send('area-marked', ...args);
  },
  signIn: (signInBody: ISignInBody, callback: SignInCallback, callbackError: SignInCallback) => {
    ipcRenderer.once('sign-in-ok', callback)
    ipcRenderer.once('sign-in-error', callbackError)
    ipcRenderer.send('sign-in', signInBody);
  },
  signUp: (signInBody: ISignUpBody, callback: SignInCallback, callbackError: SignUpCallback) => {
    ipcRenderer.once('sign-up-ok', callback)
    ipcRenderer.once('sign-up-error', callbackError)
    ipcRenderer.send('sign-up', signInBody);
  },
  defaultHostValue: (callback: HostValueCallback) => {
    ipcRenderer.once('default-host-value', callback);
    ipcRenderer.once('ask-for-default-host-value', callback);
    ipcRenderer.send('ask-for-default-host-value');
  },
})
