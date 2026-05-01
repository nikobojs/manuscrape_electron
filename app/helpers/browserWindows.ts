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
// pass existingWindow to reuse a pre-warmed BrowserWindow instead of creating a new one
const createNuxtAppWindow = (
  url: string,
  onClose: () => void,
  onReady = () => {},
  minWidth: number,
  minHeight: number,
  maxWidth?: number | undefined,
  existingWindow?: BrowserWindow | undefined,
): BrowserWindow => {
  let win: BrowserWindow;

  if (existingWindow && !existingWindow.isDestroyed()) {
    win = existingWindow;
    win.removeAllListeners("show");
    win.removeAllListeners("ready-to-show");
    win.removeAllListeners("close");
    // Apply size constraints — the warm window was created with default dimensions
    win.setMinimumSize(minWidth, minHeight);
    win.setSize(minWidth, minHeight);
    win.setMaximumSize(typeof maxWidth === "number" ? maxWidth : 0, 0);
  } else {
    win = new BrowserWindow({
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
  }

  win.loadURL(url);

  win.once("show", () => {
    onReady();
    win.focus();
    if (isMac()) {
      win.setMinimumSize(minWidth, minHeight); // should help enforce bounds on some macs
    }
  });

  win.once("close", () => onClose());

  win.on("ready-to-show", () => {
    win.show();
  });

  return win;
};

export function createSplashWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 380,
    height: 240,
    frame: false,
    resizable: false,
    center: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: "#1c1b22",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.loadFile("windows/splash.html");
  win.once("ready-to-show", () => win.show());
  return win;
}

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

// Creates a hidden overlay window pre-loaded with markArea.html.
// p5 is re-injected on every ready-to-show (initial load + after each reload).
// Call showPrewarmedOverlay() to display it; cancelOverlay() hides+reloads it.
export const createPrewarmedOverlayWindow = (
  initialDisplay: Electron.Display,
  p5Content: string,
  p5SketchContent: string,
): BrowserWindow => {
  const win = new BrowserWindow({
    title: "ManuScrape - Mark area overlay",
    frame: false,
    autoHideMenuBar: true,
    transparent: true,
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
    x: initialDisplay.workArea.x,
    y: initialDisplay.workArea.y,
    width: initialDisplay.workArea.width,
    height: initialDisplay.workArea.height,
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      backgroundThrottling: false,
      webgl: false,
    },
  });

  if (isMac()) {
    win.setMenu(null);
    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  win.loadFile("windows/markArea.html");

  // fires on initial load and after every webContents.reload()
  win.on("ready-to-show", () => {
    win.webContents.send("inject-p5-script", p5Content);
    win.webContents.send("inject-p5-sketch", p5SketchContent);
  });

  return win;
};

// Repositions the pre-warmed overlay onto activeDisplay and makes it visible.
export const showPrewarmedOverlay = (
  win: BrowserWindow,
  activeDisplay: Electron.Display,
): void => {
  const beginOpen = Date.now();

  if (!isMac()) {
    // Exit fullscreen first so setPosition takes effect, then re-enter on the target display.
    win.setFullScreen(false);
    win.setPosition(activeDisplay.workArea.x, activeDisplay.workArea.y);
    win.setFullScreen(true);
  } else {
    win.setBounds({
      x: 0,
      y: 0,
      width: activeDisplay.size.width,
      height: activeDisplay.size.height,
    });
    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  win.show();
  console.log("open overlay took", Date.now() - beginOpen, "ms - (pre-warmed)");
};

// Creates a hidden Nuxt window pre-loaded at warmUrl (typically the app root).
// The renderer process is alive and the JS bundle is parsed before it is needed.
export const createWarmNuxtWindow = (warmUrl: string): BrowserWindow => {
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
  });

  win.loadURL(warmUrl);
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
  warmWindow?: BrowserWindow,
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
    warmWindow,
  );

  return win;
};

export const createAddObservationWindow = async (
  apiHost: string,
  projectId: number,
  observationId: number,
  onClose: () => void,
  electronTheme: boolean = true,
  imgFile?: string | Buffer<ArrayBufferLike> | undefined,
  projectFieldId?: number | undefined,
  warmWindow?: BrowserWindow | undefined,
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

  if ((imgFile && !projectFieldId) || (!imgFile && projectFieldId)) {
    console.warn(
      "Expected `imgFile` and `projectFieldId` to be both defined or undefined",
      { imgFile, projectFieldId },
    );
    console.warn("Not opening image window");
  }

  // image is not provided, just open the normal observation detail view
  let beginOpen = Date.now();
  const onReady = () => {
    const openWindowTook = Date.now() - beginOpen;
    if (imgFile && projectFieldId) {
      console.log("open edit-image-new window took:", openWindowTook, "ms");
    } else {
      console.log(
        "open create empty observaiton window took:",
        openWindowTook,
        "ms",
      );
    }
  };

  if (!imgFile || !projectFieldId) {
    const win = createNuxtAppWindow(
      `${apiHost}/projects/${projectId}/observations/${observationId}?${query}`,
      onClose,
      onReady,
      1200,
      790,
      undefined,
      warmWindow,
    );
    return win;
    // if img is provided, open /edit-image-new to provide image editing before upload
  } else {
    // add projectFieldId to query
    query += `&projectFieldId=${projectFieldId}`;

    // load file
    let buffer: Buffer<ArrayBufferLike>;
    if (typeof imgFile === "string") {
      const readFileBegin = Date.now();
      buffer = await fs.promises.readFile(imgFile);
      console.log(
        "reading file imgFile took",
        Date.now() - readFileBegin,
        "ms (not using direct file buffer because is scrollshot)",
      );
    } else {
      buffer = imgFile as Buffer<ArrayBufferLike>;
    }

    let jpgImg;
    try {
      const decodingStart = Date.now();
      jpgImg = jpeg.decode(buffer, {});
      console.log("decoding jpg buffer took", Date.now() - decodingStart, "ms");
    } catch (e) {
      // image is not jpg, dont try to read it but provide defaults for scrollshot (which is png)
    }
    const imgBase64Start = Date.now();
    const imgBase64 = buffer.toString("base64");
    console.log(
      "conversion of image to base64 took",
      Date.now() - imgBase64Start,
      "ms",
    );
    const url = `${apiHost}/projects/${projectId}/observations/${observationId}/edit-image-new?${query}`;
    beginOpen = Date.now();
    const askedBegin = Date.now();
    const win = createNuxtAppWindow(
      url,
      onClose,
      () => {
        onReady();
      },
      jpgImg ? Math.max(jpgImg.width - 200, 1080) : 790,
      jpgImg ? Math.min(jpgImg.height + 300, 760) : 1200,
      undefined,
      warmWindow,
    );
    // win.webContents.openDevTools();
    // send the image directly to the window when asked for (without requiring upload before editing)
    win.webContents.ipc.once("ask-for-image", () => {
      console.log(
        "overlay frontend asked for image",
        Date.now() - askedBegin,
        "after overlay started to open",
      );
      win.webContents.send("load-image", imgBase64);
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
  warmWindow?: BrowserWindow,
): BrowserWindow => {
  const win = createNuxtAppWindow(
    `${apiHost}/projects/${projectId}/drafts?electron=1`,
    onClose,
    () => {},
    1280,
    760,
    undefined,
    warmWindow,
  );

  return win;
};
