
import { BrowserWindow } from 'electron';
import * as path from 'path';

export const createOverlayWindow = (activeDisplay: Electron.Display) => {
  const win = new BrowserWindow({
    title: "ManuScrape Overlay",
    // Remove the default frame around the window
    frame: false,
    // Hide Electron’s default menu
    autoHideMenuBar: true,
    transparent: true,
    // Do not display our app in the task bar
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    minimizable: false,
    alwaysOnTop: true,
    closable: false,
    movable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preloads/overlay.js'),
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
