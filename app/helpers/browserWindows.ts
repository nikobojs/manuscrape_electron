import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';
import path from 'path';
const isLinux = process.platform === 'linux';

// generic nuxt app window factory - not meant to be exported
const createNuxtAppWindow = (
  url: string,
  onClose: () => void,
  onReady = () => {},
  width?: number | undefined,
  height?: number | undefined,
): BrowserWindow => {

  const win = new BrowserWindow({
    title: "ManuScrape",
    autoHideMenuBar: true,
    minimizable: false,
    closable: true,
    movable: true,
    show: false,
    icon: path.join(__dirname, '../../assets/icons/desktop-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
    },
    useContentSize: true,
    backgroundColor: '#1c1b22',
    ...(
      typeof width === 'number' ?
      { minWidth: width } : {}
    ),
    ...(
      typeof height === 'number' ?
      { minHeight: height } : {}
    ),
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

    // EXPERIMENTAL: makes overlay work on gnome 3
    x: activeDisplay.bounds.x,
    y: activeDisplay.bounds.y,
    width: activeDisplay.workArea.width,
    height: activeDisplay.workArea.height,

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
    icon: path.join(__dirname, '../../assets/icons/desktop-icon.png'),
    width: 320,
    height: isLinux ? 450 : 480, // TODO: needs adjustment on windows
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
    1080,
    560,
  )

  return win;
}


export const createAddProjectWindow = (
  apiHost: string,
  onClose: () => void
): BrowserWindow => {
  const win = createNuxtAppWindow(
    `${apiHost}/projects/new?electron=1`,
    onClose,
    () => {},
    904,
    530,
  )

  return win;
}


export const createDraftsWindow = (
  apiHost: string,
  projectId: number,
  onClose: () => void
): BrowserWindow => {
  const win = createNuxtAppWindow(
    `${apiHost}/projects/${projectId}/drafts?electron=1`,
    onClose,
    () => {},
    1080,
    560,
  )

  return win;
}


