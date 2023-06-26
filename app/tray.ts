import { app, Tray, BrowserWindow, MenuItem, Menu } from 'electron';
import * as path from 'path';
import { createOverlayWindow } from './overlay';
import { ipcMain } from 'electron/main';
import { quickScreenshot, scrollScreenshot } from './screenshots';


let trayWindow;

export function createTrayWindow() {
  trayWindow = new BrowserWindow({
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
  trayWindow.loadFile('renderers/trayWindow.html');
  return trayWindow;
}


function _generateContextMenu() {
  const menuItems = [] as MenuItem[];
  const itemQuickScreenshot = new MenuItem({
    label: "Tag screenshot",
    type: "normal",
    click() {
      ipcMain.once('area-marked', quickScreenshot)
      createOverlayWindow();
    },
  });

  const itemScrollScreenshot = new MenuItem({
    label: "Tag scroll screenshot",
    type: "normal",
    click() {
      ipcMain.once('area-marked', scrollScreenshot)
      createOverlayWindow();
    },
  });

  const itemExit = new MenuItem({
    label: "Quit",
    type: "normal",
    click() {
      app.quit();
    },
  });

  menuItems.push(itemQuickScreenshot);
  menuItems.push(itemScrollScreenshot);
  menuItems.push(itemExit);

  const contextMenu = Menu.buildFromTemplate(menuItems);
  return contextMenu;
}

// setupTray creates the system tray where our application will live.
export function setupTray() {
  if (app.dock) {
    app.dock.hide();
  }

  const tray = new Tray(path.join(__dirname, "../../assets/tray.png"));

  tray.setToolTip("ManuScrape");
  tray.setContextMenu(_generateContextMenu());
  tray.setIgnoreDoubleClickEvents(true);

  tray.on("click", () => {
    tray.popUpContextMenu();
    console.log('left click')
  });

  tray.on("right-click", () => {
    tray.popUpContextMenu();
    console.log('right click')
  });

  return tray;
}
