
import { desktopCapturer, screen, app } from 'electron';
import * as fs from 'fs'
import crypto from 'crypto';

function getScreenshotFromSource(source: Electron.DesktopCapturerSource, areaRect: any) {
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

function findCapturerSourceByDisplay(
  sources: Electron.DesktopCapturerSource[],
  targetDisplay: Electron.Display
): Electron.DesktopCapturerSource {
  const screen = sources.find((s) => s.display_id == targetDisplay.id.toString());
  if (!screen) {
    throw new Error('Screen was not found')
  }
  return screen;
}


async function captureScreenshot(areaRect: any, activeScreen: Electron.Display) {
  const fullsize = activeScreen.bounds;

  // TODO: research performance issue
  console.log('capturing screenshot...')
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: fullsize,
    fetchWindowIcons: false,
  });


  const displaySource = findCapturerSourceByDisplay(sources, activeScreen);
  const screenshot = getScreenshotFromSource(displaySource, areaRect);
  return screenshot;
}

async function saveScreenshot(filename: string, buffer: string | NodeJS.ArrayBufferView) {
  const basepath = app.getPath('temp');
  const filepath = (
    basepath +
    '/' +
    filename +
    '.' +
    new Date().toISOString().replace(/\:/g, '') +
    '.jpg'
  );
  fs.writeFileSync(filepath, buffer);
  console.log('Saved screenshot to file \'' + filepath + '\'');
}


export async function quickScreenshot(_event: any, areaRect: any, activeScreen = screen.getPrimaryDisplay()) {
  const screenshot = await captureScreenshot(areaRect, activeScreen);
  await saveScreenshot(screenshot.source.name, screenshot.buffer);
}

function sleepAsync(ms: number | undefined) {
  return new Promise((ok) => setTimeout(ok, ms));
}

export async function scrollScreenshot(_event: any, areaRect: any, activeScreen = screen.getPrimaryDisplay()) {
  console.log('scroll screenshot begin!')
  const md5sums = [] as string[];
  const maxScreenshots = 512;
  const maxRepeatedScreenshots = 4;
  const minimumCaptureDelay = 500;
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