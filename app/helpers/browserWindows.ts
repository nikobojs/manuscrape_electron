import { BrowserWindow, shell, type BrowserWindowConstructorOptions } from 'electron';
import path from 'path';

// generic nuxt app window factory - not meant to be exported
const createNuxtAppWindow = (
  url: string,
  onClose: () => void,
  onReady = () => {},
  width = 320,
  height = 510,
): BrowserWindow => {
  const win = new BrowserWindow({
    title: "ManuScrape",
    autoHideMenuBar: true,
    minimizable: false,
    closable: true,
    movable: true,
    show: true,
    width,
    height,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
    },
  })

  win.loadURL(url);

  win.once('ready-to-show', () => {
    win.focus();
    onReady();
  });

  win.once('close', () => onClose());

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
    title: "ManuScrape Overlay",
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
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      backgroundThrottling: false,
      webgl: true,
    },
  })

  win.loadFile('windows/markArea.html');
  win.setBounds(activeDisplay.workArea)
  win.maximize();
  win.setFullScreen(true);
  win.show();
  win.focus();

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
  onReady: () => void
): BrowserWindow => {
  const win = createNuxtAppWindow(
    `${apiHost}/projects/${projectId}/observations/${observationId}?electron=1&uploading=1`,
    onClose,
    onReady,
    1200,
    800,
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


