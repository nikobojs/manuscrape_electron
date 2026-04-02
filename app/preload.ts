import { contextBridge, ipcRenderer, app } from "electron";
// console.log('version:', process.env.npm_package_version) (THIS WORKS)

contextBridge.exposeInMainWorld("electronAPI", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  version: (callback: VersionCallback) => {
    ipcRenderer.once("get-version-response", (event, version) => {
      callback(version);
    });
    ipcRenderer.send("get-version-request");
  },
  projectCreated: (project: any) => {
    ipcRenderer.send("project-created", project);
  },
  observationCreated: (project: any) => {
    ipcRenderer.send("observation-created", project);
  },
  areaMarked: (...args: any) => {
    ipcRenderer.send("area-marked", ...args);
  },
  takeAnother: (projectFieldId: number) => {
    ipcRenderer.send("prepare-next-screenshot", projectFieldId);
  },
  observationImageUploaded: () => {
    ipcRenderer.send("observation-image-uploaded");
  },
  signIn: (
    signInBody: ISignInBody,
    callback: SignInCallback,
    callbackError: SignInCallback,
  ) => {
    ipcRenderer.once("sign-in-ok", callback);
    ipcRenderer.once("sign-in-error", callbackError);
    ipcRenderer.send("sign-in", signInBody);
  },
  signUp: (
    signInBody: ISignUpBody,
    callback: SignInCallback,
    callbackError: SignUpCallback,
  ) => {
    ipcRenderer.once("sign-up-ok", callback);
    ipcRenderer.once("sign-up-error", callbackError);
    ipcRenderer.send("sign-up", signInBody);
  },
  updateSettings: (
    settingsBody: ISettings,
    callback: UpdateSettingsCallback,
    callbackError: UpdateSettingsCallback,
  ) => {
    ipcRenderer.once("update-settings-ok", callback);
    ipcRenderer.once("update-settings-error", callbackError);
    ipcRenderer.send("update-settings", settingsBody);
  },
  defaultHostValue: (callback: HostValueCallback) => {
    ipcRenderer.once("default-host-value", callback);
    ipcRenderer.once("ask-for-default-host-value", callback); // TODO: is this one needed?
    ipcRenderer.send("ask-for-default-host-value");
  },
  getSettings: (callback: HostValueCallback) => {
    ipcRenderer.once("get-settings-response", callback);
    ipcRenderer.send("get-settings-request");
  },
  getDefaultSettings: (callback: HostValueCallback) => {
    ipcRenderer.once("get-default-settings-response", callback);
    ipcRenderer.send("get-default-settings-request");
  },
  onStatus: (callback: MarkAreaStatusCallback) => {
    ipcRenderer.removeAllListeners("mark-area-status");
    ipcRenderer.on("mark-area-status", callback);
  },
  onDeprecatedClientError: (callback: DeprecatedClientErrorCallback) => {
    ipcRenderer.removeAllListeners("client-is-deprecated");
    ipcRenderer.once("client-is-deprecated", callback);
    ipcRenderer.send('ask-client-is-deprecated');
  },
});
