const { app, Tray, BrowserWindow, MenuItem, Menu } = require('electron');
const path = require('path');
const { createOverlayWindow } = require('./overlay');

let trayWindow;

function createTrayWindow() {
  trayWindow = new BrowserWindow({
    title: "ManuScrape",
    width: 0,
    height: 0,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    setVisibleOnAllWorkspaces: true,
    skipTaskbar: true,
    hasShadow: false,
  });
  trayWindow.loadFile('renderers/trayWindow.html');
  return trayWindow;
}


function _generateContextMenu() {
  const menuItems = [];
  const itemQuickScreenshot = new MenuItem({
    label: "Tag screenshot",
    type: "normal",
    click() {
      createOverlayWindow('renderers/quickScreenshotWindow.html');
    },
  });

  const itemScrollScreenshot = new MenuItem({
    label: "Tag scroll screenshot",
    type: "normal",
    click() {
      createOverlayWindow('renderers/scrollScreenshotWindow.html');
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
function setupTray() {
  if (app.dock) {
    app.dock.hide();
  }

  tray = new Tray(path.join(__dirname, "../assets/tray.png"));

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


module.exports = {
  setupTray,
  createTrayWindow,
};