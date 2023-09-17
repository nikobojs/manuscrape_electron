import { desktopCapturer, app, Notification, ipcMain, globalShortcut, BrowserWindow } from 'electron';
import path from 'path';
import { sleepAsync } from './utils';
import { joinImagesVertically } from './pythonBridge';
import { errorIcon } from './icons';
import { blockhashData, hammingDistance } from './blockhash-js';
import jpeg from 'jpeg-js';
import fs from 'fs';


function getScreenshotFromSource(
  source: Electron.DesktopCapturerSource,
  areaRect: any
): IScreenshot {
  const image = source.thumbnail.crop(areaRect);
  const size = image.getSize();
  const buffer = image.toJPEG(100);
  const sizeKb = Math.floor(buffer.byteLength / 1024);

  const screenshot: IScreenshot = {
    image,
    size,
    sizeKb,
    buffer,
    source
  };

  console.log('Captured screenshot: len=' + sizeKb + 'kb, size=' + size.width + 'x' + size.height);

  return screenshot;
}


function findCapturerSourceByDisplay(
  sources: Electron.DesktopCapturerSource[],
  targetDisplay: Electron.Display,
  targetDisplayIndex: number,
): Electron.DesktopCapturerSource {
  let screen = sources.find((s) => s.display_id == targetDisplay.id.toString());
  if (screen) {
    return screen;
  } else if (!screen && sources.length - 1 >= targetDisplayIndex) {
    return sources[targetDisplayIndex];
  } else {
    throw new Error('Screen was not found')
  }
}


async function captureScreenshot(
  areaRect: any,
  activeScreen: Electron.Display,
  activeDisplayIndex: number,
): Promise<IScreenshot> {
  const fullsize = activeScreen.bounds;

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: fullsize,
    fetchWindowIcons: false,
  });

  const displaySource = findCapturerSourceByDisplay(sources, activeScreen, activeDisplayIndex);
  const screenshot = getScreenshotFromSource(displaySource, areaRect);
  return screenshot;
}

function getTempPath(): string {
  const fullPath = path.join(app.getPath('temp'), 'manuscrape');
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath);
  }
  return fullPath;
}


export async function saveScreenshot(
  filename: string,
  buffer: string | NodeJS.ArrayBufferView,
  directory?: string | undefined,
): Promise<string> {

  let basepath = getTempPath();

  if (directory) {
    basepath = path.join(basepath, directory);
    fs.mkdirSync(basepath, { recursive: true });
  }

  const filepath = path.join(
    basepath,
    filename +
    '.' +
    new Date().toISOString().replace(/\:/g, '') +
    '.jpg'
  );
  fs.writeFileSync(filepath, buffer);
  console.log('Saved screenshot to file \'' + filepath + '\'');
  return filepath;
}


// TODO: fix typing
export async function quickScreenshot(
  areaRect: any,
  activeDisplay: Electron.Display,
  activeDisplayIndex: number,
  _isCancelled: () => boolean,
): Promise<string> {
  const screenshot = await captureScreenshot(areaRect, activeDisplay, activeDisplayIndex);
  const path = await saveScreenshot(screenshot.source.name, screenshot.buffer);
  return path;
}


// TODO: fix typing
export async function scrollScreenshot(
  areaRect: any,
  activeDisplay: Electron.Display,
  activeDisplayIndex: number,
  isCancelled: () => boolean,
): Promise<string> {
  const maxScreenshots = 512;
  const maxRepeatedScreenshots = 50;
  const minimumCaptureDelay = 428;
  const hammeringDiffThreshold = 1000;
  const scrollShotId = new Date().getTime();
  const dirname = scrollShotId.toString();
  const resultImageDir = path.join(app.getPath('userData'), dirname, 'output');
  const resultImagePath = path.join(resultImageDir, 'result.png');

  let repeatedScreenshots = 0;
  let lastSavePath: string | null = null;
  let userIsDone = false;
  let lastImageHash = null;
  let totalScreenshots = 0;

  // change shortcut so it saves instead of initiating a scrollshot
  globalShortcut.unregister('Alt+S');
  globalShortcut.register('Alt+S', () => userIsDone = true);

  // run loop until canceled/finished by user or maximum screenshots reached
  while (totalScreenshots < maxScreenshots && !isCancelled()) {
    if (isCancelled()) {
      // TODO: cleanup files etc
      throw new Error('Cancelled');
    }

    // get time before screenshot is taken
    // NOTE: this is used further down to determine how long to wait between each loop cycle
    const beforeCapture = new Date().getTime();

    // capture, decode and hash image
    const { source, buffer } = await captureScreenshot(areaRect, activeDisplay, activeDisplayIndex);
    const data = jpeg.decode(buffer);
    const imageHash = blockhashData(data, 128, 2);


    // get the distance to the last image captured
    let imageDiff;
    if (lastImageHash) {
      imageDiff = hammingDistance(imageHash, lastImageHash);
    }

    // update the last image captured hash to the new one
    lastImageHash = imageHash;

    // get time after capture is done and measure how long it took
    const afterCapture = new Date().getTime();
    const captureTookMs = beforeCapture - afterCapture;

    // calculate the delay to wait based on howLong
    const delay = Math.max(0, captureTookMs + minimumCaptureDelay);

    // decide what to do in different scenarios
    if (userIsDone || repeatedScreenshots > maxRepeatedScreenshots) {
      // is max screenshots are reached or user finished the scrollshots, break loop
      break;
    } else if (!lastImageHash || (imageDiff && imageDiff > hammeringDiffThreshold)) {
      // if first image or hammer distance is above threshold, save screenshot and update state
      repeatedScreenshots = 0;
      lastSavePath = await saveScreenshot(source.name, buffer, dirname);
      totalScreenshots++;
    } else {
      repeatedScreenshots++;
    }

    // sleep the calculated delay to keep fixed delay between screenshots
    await sleepAsync(delay);
  }

  // create directory for the joined image
  fs.mkdirSync(resultImageDir, { recursive: true });

  // if there are more than one screenshot, join the images to one big and return path
  if (totalScreenshots > 1) {
    try {
      await joinImagesVertically(
        path.join(getTempPath(), dirname),
        resultImagePath,
      );
      return resultImagePath;
    } catch (err) {
      new Notification({
        title: 'Unable to process scrollshot :(',
        body: 'Please scroll slowly either up or down',
        icon: errorIcon,
      }).show()
      throw new Error('Unable to join scrollshot images to one single image');
      // TODO: report error
    }
  } else if (lastSavePath) {
    // else if there is only one image, return its path
    return lastSavePath;
  } else {
    if (isCancelled()) {
      throw new Error('Cancelled');
    } else {
      throw new Error('Unable to save scroll shot!');
    }
  }
}
