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
  takeAnother: (observationId: number) => {
    ipcRenderer.send("prepare-next-screenshot", observationId);
  },
  observationImageUploaded: () => {
    ipcRenderer.send("observation-image-uploaded");
  },
  chooseServer: (
    body: { host: string },
    callback: () => void,
    callbackError: (errorMessage: string) => void,
  ) => {
    ipcRenderer.once("choose-server-ok", callback);
    ipcRenderer.once("choose-server-error", (_event, errorMessage) => {
      callbackError(errorMessage);
    });
    ipcRenderer.send("choose-server", body);
  },
  loginSuccess: (
    callback: () => void,
    callbackError: (errorMessage: string) => void,
  ) => {
    console.log('login success preload!!!!!!!!!!!!!!!!!!!!!!!!!1')
    ipcRenderer.once("login-success-ok", callback);
    ipcRenderer.once("login-success-error", (_event, errorMessage) => {
      callbackError(errorMessage);
    });
    ipcRenderer.send("login-success");
  },
  signupSuccess: (
    callback: () => void,
    callbackError: (errorMessage: string) => void,
  ) => {
    ipcRenderer.once("signup-success-ok", callback);
    ipcRenderer.once("signup-success-error", (_event, errorMessage) => {
      callbackError(errorMessage);
    });
    ipcRenderer.send("signup-success");
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
    ipcRenderer.send("ask-client-is-deprecated");
  },
  useP5Script: (callback: () => void) => {
    console.log("listening to p5 injections!");
    ipcRenderer.on("inject-p5-script", (_, scriptContent) => {
      const script = document.createElement("script");
      script.textContent = scriptContent;
      document.head.appendChild(script);
      callback();
    });
  },
  useP5Sketch: (callback: () => void) => {
    ipcRenderer.on("inject-p5-sketch", (_, scriptContent) => {
      const script = document.createElement("script");
      script.textContent = scriptContent;
      script.onload = () => callback();
      document.body.appendChild(script);
      callback();
    });
  },
  useLocalImg: (callback: (_imgBase64: string) => void) => {
    ipcRenderer.on("load-image", (_, imgBase64) => {
      callback(imgBase64);
    });
    ipcRenderer.send("ask-for-image");
  },
});
