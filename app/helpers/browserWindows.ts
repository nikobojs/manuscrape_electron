import { BrowserWindow, shell } from 'electron';
import path from 'path';


export function createTrayWindow() {
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


export const createOverlayWindow = (activeDisplay: Electron.Display) => {
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


export const createSignInWindow = () => {
  const win = new BrowserWindow({
    title: "ManuScrape - Sign in",
    autoHideMenuBar: true,
    minimizable: false,
    closable: true,
    movable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
    }
  })

  
  win.loadFile('windows/signIn.html');

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  return win;
}