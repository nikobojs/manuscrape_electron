const { app, BrowserWindow, Tray, MenuItem, Menu } = require('electron');
const path = require('path');

function createTrayWindow() {
  // Create the window that opens on app start
  // and tray click
  trayWindow = new BrowserWindow({
    title: "Daily",
    //webPreferences: {
    //  preload: path.join(__dirname, "preloadTray.js"),
    //},
    width: 290,
    height: 300,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    setVisibleOnAllWorkspaces: true,
    transparent: true,
    skipTaskbar: true,
    hasShadow: false,
  });
  trayWindow.loadFile("public/tray.html");
  return trayWindow;
}


function setupTrayMenu() {
  const menuItems = [];
  const itemMarkArea = new MenuItem({
    label: "Marker omraade",
    type: "normal",
    click() {
      createWindow();
    },
  });

  const itemExit = new MenuItem({
    label: "Quit",
    type: "normal",
    click() {
      app.quit();
    },
  });

  menuItems.push(itemMarkArea);
  menuItems.push(itemExit);

  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.contextMenu = contextMenu;
}

// setupTray creates the system tray where our application will live.
function setupTray(trayWindow) {
  if (app.dock) {
    app.dock.hide();
  }

  tray = new Tray(path.join(__dirname, "../assets/tray.png"));

  tray.setToolTip("ManuScrape");
  tray.setIgnoreDoubleClickEvents(true);
  tray.on("click", function (e) {
    if (trayWindow.isVisible()) {
      trayWindow.hide();
      return;
    }
    trayWindow.show();
  });
  tray.on("right-click", () => {
    tray.popUpContextMenu(tray.contextMenu);
  });

  setupTrayMenu(false);
}


module.exports = {
  createTrayWindow,
  setupTray,
  setupTrayMenu,
};