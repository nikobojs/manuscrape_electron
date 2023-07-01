import { app, Tray, MenuItem, Menu, screen, BrowserWindow } from 'electron';
import * as path from 'path';
import { createOverlayWindow } from './overlay';
import { ipcMain } from 'electron/main';
import { quickScreenshot, scrollScreenshot } from './screenshots';


export let tray: Tray | undefined;

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

function chooseScreen(display: Electron.Display) {
  refreshContextMenu(display);
}

export function refreshContextMenu(activeDisplay: Electron.Display): void {
  if (!tray) {
    throw new Error('Cannot refresh contextmenu before tray is created')
  }

  ipcMain.removeAllListeners();

  const menuItems = [] as MenuItem[];
  const itemQuickScreenshot = new MenuItem({
    label: "Nyt screenshot",
    type: "normal",
    click() {
      console.log('create overlay!')
      ipcMain.once('area-marked', (_event, area) => quickScreenshot(area, activeDisplay))
      createOverlayWindow(activeDisplay);
    },
  });

  const itemScrollScreenshot = new MenuItem({
    label: "Nyt scroll screenshot",
    type: "normal",
    click() {
      ipcMain.once('area-marked', (_event, area) => scrollScreenshot(area, activeDisplay))
      createOverlayWindow(activeDisplay);
    },
  });

  const screenMenu = new MenuItem({
    label: "Aktiv skærm",
    submenu: [],
    type: 'submenu'
  });

  const displays = screen.getAllDisplays();
  for (let i = 0; i < displays.length; i++) {
    const screenMenuItem = new MenuItem({
      label: displays[i].label,
      id: displays[i].id.toString(),
      type: 'radio',
      checked: displays[i].id == activeDisplay.id,
      click: () => {
        chooseScreen(displays[i]);
      }
    })
    screenMenu.submenu?.insert(i, screenMenuItem)
  }

  const itemExit = new MenuItem({
    label: "Quit",
    role: "quit",
  });

  menuItems.push(itemQuickScreenshot);
  menuItems.push(itemScrollScreenshot);
  menuItems.push(screenMenu);
  menuItems.push(itemExit);

  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.setContextMenu(contextMenu);
}

export function openMenu() {
  if (tray) {
    tray.popUpContextMenu();
    console.log('right click')
  }
}

// setupTray creates the system tray where our application will live.
export async function setupTray(): Promise<void> {
  if (app.dock) {
    app.dock.hide(); // TODO: what does it do
  }

  const defaultDisplay = screen.getPrimaryDisplay();

  // ensure there is only created 1 tray instance
  if (!tray) {
    tray = new Tray(path.join(__dirname, "../../assets/tray.png"));
    tray.setToolTip("ManuScrape");
    tray.setIgnoreDoubleClickEvents(true);
    refreshContextMenu(defaultDisplay);
    tray.on("click", openMenu);
    tray.on("right-click", openMenu);
  } else {
    refreshContextMenu(defaultDisplay);
  }
}
