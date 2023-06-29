
import { BrowserWindow } from 'electron';
import * as path from 'path';

export const createOverlayWindow = () => {
  console.log('Opening screenshot overlay...');
  const win = new BrowserWindow({
    title: "ManuScrape Overlay",
    // Remove the default frame around the window
    frame: false,
    fullscreen: true,
    // Hide Electron’s default menu
    autoHideMenuBar: true,
    transparent: true,
    // Do not display our app in the task bar
    // (It will live in the system tray!)
    skipTaskbar: true,
    hasShadow: false,
    show: true,
    minimizable: false,
    alwaysOnTop: true,
    closable: false,
    movable: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preloads/overlay.js'),
      backgroundThrottling: false,
      webgl: true,
      devTools: true
    },
  })

  win.loadFile('windows/markArea.html');
  win.maximize();
  win.setFullScreen(true);
  win.focus();

  return win;
}
