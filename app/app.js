const { app, BrowserWindow, Tray, MenuItem, Menu, globalShortcut, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs')
let mainWindow;

function saveScreenshot(event, square, activeScreen = screen.getPrimaryDisplay()) {
  if (mainWindow) {
    mainWindow.close();
  }

  const fullsize = activeScreen.bounds;

  if (square[2] < 0) {
     square[2] = Math.abs(square[2])
     square[0] -= square[2]
  }

  if (square[3] < 0) {
    square[3] = Math.abs(square[3])
    square[1] -= square[3]
  }


  const squareRect = {
    x: square[0],
    y: square[1],
    width: square[2],
    height: square[3],
  }

  desktopCapturer.getSources({
    types: ['screen'], thumbnailSize: fullsize
  }).then(sources => {
    const screenshots = [];
    for (let s in sources) {
      const source = sources[s];
      if (source.display_id != activeScreen.id) {
        continue;
      }
      const image = source.thumbnail.crop(squareRect);
      const size = image.getSize();
      const buffer = image.toJPEG(100);

      screenshots.push({
        image,
        size,
        buffer,
        source
      });

      const kilobytes = Math.floor(buffer.byteLength / 1024);

      console.log('Captured screenshot: len=' + kilobytes + 'kb, size='+size.width+'x'+size.height);
    }

    return Promise.resolve(screenshots);
  }).then((screenshots) => {
    for (let screenshot of screenshots) {
      const { source, buffer } = screenshot;
      const filename = './.screenshots/' + source.name + '.' + new Date().toISOString().replace(/\:/g, '') + '.jpg';
      fs.writeFileSync(filename, buffer);
      console.log('Saved screenshot to file \'' + filename + '\'');
    }
  });


}


const createWindow = () => {
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
    // Don't show the window until the user is in a call.
    show: true,
    webPreferences: {
      preload: path.join(__dirname, '../preloads/saveScreenshotIpc.js')
    }
  })
  mainWindow = win;
  win.webContents.openDevTools();

  win.loadFile('public/overlay.html');

  return win;

}



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



app.whenReady().then(() => {
  ipcMain.on('save-screenshot', saveScreenshot)

  globalShortcut.register('Alt+Q', () => {
    console.log('Quitting ManuScrape...');
    app.exit(0)
  })


  globalShortcut.register('Alt+N', () => {
    console.log('Creating new screenshot...');
    mainwindow = createWindow();
  })
  const trayWindow = createTrayWindow()

  trayWindow.on("blur", () => {
    trayWindow.hide();
  });
  trayWindow.on("show", () => {
    trayWindow.focus();
  });


  setupTray(trayWindow);
  setupTrayMenu();

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
  });

})