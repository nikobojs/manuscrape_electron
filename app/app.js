const { app, globalShortcut, ipcMain, desktopCapturer, screen } = require('electron');
const fs = require('fs')
const crypto = require('crypto');
const { setupTray, createTrayWindow } = require('./tray.js');
const { createOverlayWindow } = require('./overlay.js');

let trayWindow;

app.commandLine.appendSwitch('webrtc-max-cpu-consumption-percentage', '100')


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
  const fullsize = activeScreen.bounds;

  // TODO: research performance issue
  console.log('capturing screenshot...')
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: fullsize,
    fetchWindowIcons: false,
  });


  const displaySource = findCorrectScreen(sources, activeScreen);
  const screenshot = getScreenshotFromSource(displaySource, areaRect);
  return screenshot;
}

async function saveScreenshot(filename, buffer) {
  const filepath = (
    './.screenshots/' +
    filename +
    '.' +
    new Date().toISOString().replace(/\:/g, '') +
    '.jpg'
  );
  fs.writeFileSync(filepath, buffer);
  console.log('Saved screenshot to file \'' + filepath + '\'');
}

async function quickScreenshot(_event, areaRect, activeScreen = screen.getPrimaryDisplay()) {
  const screenshot = await captureScreenshot(areaRect, activeScreen);
  await saveScreenshot(screenshot.source.name, screenshot.buffer);
}

function sleepAsync(ms) {
  return new Promise((ok) => setTimeout(ok, ms));
}

async function scrollScreenshot(_event, areaRect, activeScreen = screen.getPrimaryDisplay()) {
  console.log('scroll screenshot begin!')
  const md5sums = [];
  const maxScreenshots = 512;
  const maxRepeatedScreenshots = 3;
  const minimumCaptureDelay = 150;
  let repeatedScreenshots = 0;

  for (let i = 0; i < maxScreenshots; i++) {
    const beforeCapture = new Date().getTime();

    const { source, buffer } = await captureScreenshot(areaRect, activeScreen);

    const afterCapture = new Date().getTime();
    const captureTookMs = beforeCapture - afterCapture;
    const delay = Math.max(0, captureTookMs + minimumCaptureDelay);

    const before = new Date().getTime();

    // TODO: use image hash that can measure similarity (hammering)
    const hash = crypto
      .createHash('md5')
      .update(buffer)
      .digest("base64");
      const after = new Date().getTime();
    console.log('hash took', after - before, 'ms')
      
    if (repeatedScreenshots > maxRepeatedScreenshots) {
      console.log('stopped because of screenshot movement timeout error!')
      break;
    } else if (!md5sums.includes(hash)) {
      repeatedScreenshots = 0;
      md5sums.push(hash);
      await saveScreenshot(source.name, buffer);
    } else {
      repeatedScreenshots++;
    }

    await sleepAsync(delay);

  }


  console.log('DONE');
}



app.whenReady().then(() => {
  // TODO NIKO: convert into one
  ipcMain.on('quick-screenshot', quickScreenshot)
  ipcMain.on('scroll-screenshot', scrollScreenshot)

  globalShortcut.register('Alt+Q', () => {
    console.log('Quitting ManuScrape...');
    app.exit(0)
  })


  globalShortcut.register('Alt+N', createOverlayWindow)
  trayWindow = createTrayWindow();

  setupTray();

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    console.log('bye');
  })
});