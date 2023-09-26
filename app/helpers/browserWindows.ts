import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';
import path from 'path';
const isLinux = process.platform === 'linux';

// generic nuxt app window factory - not meant to be exported
const createNuxtAppWindow = (
  url: string,
  onClose: () => void,
  onReady = () => {},
): BrowserWindow => {
  const win = new BrowserWindow({
    title: "ManuScrape",
    autoHideMenuBar: true,
    minimizable: false,
    closable: true,
    movable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
    },
    useContentSize: true,
    backgroundColor: '#1c1b22',
    minWidth: 1270,
    minHeight: isLinux ? 910 : 840,
  })

  win.loadURL(url);

  win.once('show', () => {
    onReady();
    win.focus();
  });

  win.once('close', () => onClose());

  win.show();

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
  trayWindow.loadFile('windows/tray.html');
  return trayWindow;
}


export const createOverlayWindow = (activeDisplay: Electron.Display): BrowserWindow => {
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
    fullscreen: true,
    hiddenInMissionControl: true,
    thickFrame: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      backgroundThrottling: false,
      webgl: true,
    },
  })

  win.loadFile('windows/markArea.html');
  win.setBounds(activeDisplay.workArea)
  win.show();
  // win.webContents.openDevTools();

  return win;
}


export const createAuthorizationWindow = (openSignUp = false): BrowserWindow => {
  const opts: BrowserWindowConstructorOptions = {
    title: "ManuScrape",
    autoHideMenuBar: true,
    minimizable: false,
    closable: true,
    movable: true,
    show: true,
    resizable: false,
    width: 320,
    height: 510,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
    },
  }

  const file = openSignUp ? 'windows/signUp.html' : 'windows/signIn.html';
  const win = new BrowserWindow(opts);

  win.loadFile(file);

  win.once('show', () => {
    win.focus();
  });

  return win;
}

export const createAddObservationWindow = (
  apiHost: string,
  projectId: number,
  observationId: number,
  onClose: () => void,
  onReady?: undefined | (() => void),
  uploading: boolean = true,
  electronTheme: boolean = true,
): BrowserWindow => {
  const flags: Record<string, boolean> = {
    'uploading': uploading,
    'electron': electronTheme,
  };

  const query = Object.entries(flags).reduce((params, [key, val]) => {
    if (val) params.push(`${key}=1`);
    return params;
  }, [] as string[]).join('&');

  const win = createNuxtAppWindow(
    `${apiHost}/projects/${projectId}/observations/${observationId}?${query}`,
    onClose,
    onReady,
  )

  return win;
}


export const createAddProjectWindow = (
  apiHost: string,
  onClose: () => void
): BrowserWindow => {
  const win = createNuxtAppWindow(
    `${apiHost}/`,
    onClose
  )

  return win;
}


