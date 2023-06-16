const { app, BrowserWindow, globalShortcut, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs')
const { setupTray, createTrayWindow } = require('./tray.js');

let overlayWindow;
let trayWindow;


function getScreenshotFromSource(source, areaRect) {
  const image = source.thumbnail.crop(areaRect);
  const size = image.getSize();
  const buffer = image.toJPEG(100);
  const sizeKb = Math.floor(buffer.byteLength / 1024);

  const screenshot = {
    image,
    size,
    sizeKb,
    buffer,
    source
  };

  console.log('Captured screenshot: len=' + sizeKb + 'kb, size='+size.width+'x'+size.height);

  return screenshot;
}

function findCorrectScreen(sources, targetDisplay) {
  return sources.find((s) => s.display_id == targetDisplay.id)
}


async function captureScreenshot(areaRect, activeScreen) {
  if (overlayWindow) {
    overlayWindow.close();
  }

  const fullsize = activeScreen.bounds;

  const sources = await desktopCapturer.getSources({
    types: ['screen'], thumbnailSize: fullsize
  });

  const displaySource = findCorrectScreen(sources, activeScreen);
  const screenshot = getScreenshotFromSource(displaySource, areaRect);

  return screenshot;
}

async function saveScreenshot(screenshot) {
  const { source, buffer } = screenshot;
  const filename = (
    './.screenshots/' +
    source.name +
    '.' +
    new Date().toISOString().replace(/\:/g, '') +
    '.jpg'
  );
  fs.writeFileSync(filename, buffer);
  console.log('Saved screenshot to file \'' + filename + '\'');
}

async function quickScreenshot(_event, areaRect, activeScreen = screen.getPrimaryDisplay()) {
  const screenshot = await captureScreenshot(areaRect, activeScreen);
  await saveScreenshot(screenshot);
}


const createOverlayWindow = () => {
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
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preloads/overlay.js')
    }
  })

  // win.webContents.openDevTools();

  win.loadFile('renderers/overlayWindow.html');

  return win;
}


app.whenReady().then(() => {
  ipcMain.on('quick-screenshot', quickScreenshot)

  globalShortcut.register('Alt+Q', () => {
    console.log('Quitting ManuScrape...');
    app.exit(0)
  })


  globalShortcut.register('Alt+N', () => {
    console.log('Opening screenshot overlay...');
    overlayWindow = createOverlayWindow();
  })
  trayWindow = createTrayWindow();

  // trayWindow.on("blur", () => {
  //   trayWindow.hide();
  // });
  // trayWindow.on("show", () => {
  //   trayWindow.focus();
  // });


  setupTray();

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
  });
});