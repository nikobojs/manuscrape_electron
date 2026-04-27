import jpeg from "jpeg-js";
import {
  BrowserWindow,
  ipcMain,
  type BrowserWindowConstructorOptions,
} from "electron";
import path from "path";
import { defaultSettings } from "./settings";
import { getMainIconPathBasedOnOS } from "./icons";
import fs from "fs";
import { isMac } from "./os";
const isLinux = process.platform === "linux";

// generic nuxt app window factory - not meant to be exported
const createNuxtAppWindow = (
  url: string,
  onClose: () => void,
  onReady = () => {},
  minWidth: number,
  minHeight: number,
  maxWidth?: number | undefined,
): BrowserWindow => {
  const win = new BrowserWindow({
    title: "ManuScrape",
    autoHideMenuBar: true,
    minimizable: false,
    closable: true,
    movable: true,
    show: false,
    icon: getMainIconPathBasedOnOS(),
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
    },
    useContentSize: true,
    backgroundColor: "#1c1b22",
    ...(typeof minWidth === "number" ? { minWidth, width: minWidth } : {}),
    ...(typeof minHeight === "number" ? { minHeight, height: minHeight } : {}),
    ...(typeof maxWidth === "number" ? { maxWidth } : {}),
  });

  win.loadURL(url);

  win.once("show", () => {
    onReady();
    win.focus();
    if (isMac()) {
      win.setMinimumSize(minWidth, minHeight); // should help enforce bounds on some macs
    }
  });

  win.once("close", () => onClose());

  win.show();

  return win;
};

export function createTrayWindow(): BrowserWindow {
  const trayWindow = new BrowserWindow({
    title: "ManuScrape",
    width: 0,
    height: 0,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    darkTheme: true,
    skipTaskbar: true,
    hasShadow: false,
  });
  trayWindow.loadFile("windows/tray.html");
  return trayWindow;
}

export const createOverlayWindow = (
  activeDisplay: Electron.Display,
): BrowserWindow => {
  const win = new BrowserWindow({
    title: "ManuScrape - Mark area overlay",
    // remove the default frame around the window
    frame: false,
    // hide Electron’s default menu
    autoHideMenuBar: true,
    transparent: true,
    // do not display our app in the task bar
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    minimizable: false,
    alwaysOnTop: true,
    closable: false,
    movable: false,
    focusable: false,
    hiddenInMissionControl: true,
    thickFrame: false,

    // Sets width and height for non fullscreen
    // Makes overlay work on gnome 3
    x: activeDisplay.bounds.x,
    y: activeDisplay.bounds.y,
    width: activeDisplay.workArea.width,
    height: activeDisplay.workArea.height,

    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      backgroundThrottling: false,
      webgl: true,
    },
  });

  if (!isMac()) {
    win.setFullScreen(true);
  } else {
    win.setMenu(null);
    win.setBounds({
      x: 0,
      y: 0,
      width: activeDisplay.size.width,
      height: activeDisplay.size.height,
    });
    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  win.loadFile("windows/markArea.html");
  win.setBounds(activeDisplay.workArea);

  const beginOpen = Date.now();
  win.on("ready-to-show", () => {
    const openOverlayTook = Date.now() - beginOpen;
    console.log("open overlay took", openOverlayTook, "ms");
  });

  win.show();
  // win.webContents.openDevTools();

  return win;
};

export const createAuthorizationWindow = (
  openSignUp = false,
): BrowserWindow => {
  const opts: BrowserWindowConstructorOptions = {
    title: "ManuScrape",
    autoHideMenuBar: true,
    minimizable: false,
    closable: true,
    movable: true,
    show: true,
    resizable: false,
    icon: path.join(__dirname, "../../assets/icons/desktop-icon.png"),
    width: 320,
    height: isLinux ? 450 : 480, // TODO: needs adjustment on windows
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
    },
  };

  const file = openSignUp ? "windows/signUp.html" : "windows/signIn.html";
  const win = new BrowserWindow(opts);

  win.loadFile(file);

  win.once("show", () => {
    win.focus();
  });

  return win;
};

export const createSettingsWindow = (
  apiHost: string,
  getSettings: () => ISettings,
  updateHandler: (
    event: Electron.IpcMainEvent,
    patch: ISettings,
  ) => Promise<void>,
) => {
  // cleanup and use best ipc practices
  ipcMain.removeAllListeners("update-settings");
  ipcMain.removeAllListeners("get-settings-request");
  ipcMain.removeAllListeners("get-default-settings-request");
  ipcMain.removeAllListeners("ask-for-default-host-value");
  ipcMain.removeAllListeners("ask-for-error-message");

  // attach new event listeners
  ipcMain.on(
    "update-settings", // TODO: use enum
    (event, body) => updateHandler(event, body),
  );
  ipcMain.on(
    "get-settings-request", // TODO: use enum
    (event) => {
      const settings = getSettings();
      event.reply("get-settings-response", settings);
    },
  );
  ipcMain.on(
    "get-default-settings-request", // TODO: use enum
    (event) => {
      event.reply("get-default-settings-response", defaultSettings);
    },
  );

  const win = createNuxtAppWindow(
    `${apiHost}/user?electron=1`,
    () => {
      // onClose event
    },
    () => {
      // onReady event
    },
    402,
    560,
    492,
  );

  return win;
};

export const createAddObservationWindow = async (
  apiHost: string,
  projectId: number,
  observationId: number,
  onClose: () => void,
  _onReady?: undefined | (() => void),
  electronTheme: boolean = true,
  imgFilePath?: string | undefined,
  projectFieldId?: number | undefined,
): Promise<BrowserWindow> => {
  const flags: Record<string, boolean> = {
    electron: electronTheme,
  };

  // add flags to query
  let query = Object.entries(flags)
    .reduce((params, [key, val]) => {
      if (val) params.push(`${key}=1`);
      return params;
    }, [] as string[])
    .join("&");

  if ((imgFilePath && !projectFieldId) || (!imgFilePath && projectFieldId)) {
    console.warn(
      "Expected `imgFilePath` and `projectFieldId` to be both defined or undefined",
      { imgFilePath, projectFieldId },
    );
    console.warn("Not opening image window");
  }

  // image is not provided, just open the normal observation detail view
  const beginOpen = Date.now();
  const onReady = () => {
    const openWindowTook = Date.now() - beginOpen;
    if (imgFilePath && projectFieldId) {
      console.log("open edit-image-new window took:", openWindowTook, "ms");
    } else {
      console.log(
        "open create empty observaiton window took:",
        openWindowTook,
        "ms",
      );
    }
    return _onReady?.();
  };

  if (!imgFilePath || !projectFieldId) {
    const win = createNuxtAppWindow(
      `${apiHost}/projects/${projectId}/observations/${observationId}?${query}`,
      onClose,
      onReady,
      1200,
      790,
    );
    return win;
    // if img is provided, open /edit-image-new to provide image editing before upload
  } else {
    // add projectFieldId to query
    query += `&projectFieldId=${projectFieldId}`;

    // load file
    const buffer = await fs.promises.readFile(imgFilePath);
    let jpgImg;
    try {
      jpgImg = jpeg.decode(buffer, {});
    } catch (e) {
      // image is not jpg, dont try to read it but provide defaults for scrollshot (which is png)
    }
    const imgBase64 = buffer.toString("base64");
    const url = `${apiHost}/projects/${projectId}/observations/${observationId}/edit-image-new?${query}`;
    const win = createNuxtAppWindow(
      url,
      onClose,
      onReady,
      jpgImg ? Math.max(jpgImg.width - 200, 1080) : 790,
      jpgImg ? Math.min(jpgImg.height + 300, 760) : 1200,
    );
    // win.webContents.openDevTools();

    // execute js in the window, to add img to the session storage (without requiring upload before editing)
    const moveImgStart = Date.now();
    win.webContents
      .executeJavaScript(
        `
      sessionStorage.setItem(
        "pendingImageFile",
        JSON.stringify({
          name: "image.jpg",
          type: "image/jpeg",
          data: "${imgBase64}",
        }),
      );
    `,
      )
      .then(() => {
        const moveImgTook = Date.now() - moveImgStart;
        console.log("moving of image into chromium took", moveImgTook, "ms");
      });

    return win;
  }
};

export const createAddProjectWindow = (
  apiHost: string,
  onClose: () => void,
): BrowserWindow => {
  const win = createNuxtAppWindow(
    `${apiHost}/projects/new?electron=1`,
    onClose,
    () => {},
    1280,
    760,
  );

  return win;
};

export const createDraftsWindow = (
  apiHost: string,
  projectId: number,
  onClose: () => void,
): BrowserWindow => {
  const win = createNuxtAppWindow(
    `${apiHost}/projects/${projectId}/drafts?electron=1`,
    onClose,
    () => {},
    1280,
    760,
  );

  return win;
};
