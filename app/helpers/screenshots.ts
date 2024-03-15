import {
  desktopCapturer,
  app,
  Notification,
  ipcMain,
  globalShortcut,
} from 'electron';
import path from 'path';
import { sleepAsync } from './utils';
import { joinImagesVertically } from './pythonBridge';
import { cropVideoFile } from './ffmpegBridge';
import { errorIcon } from './icons';
import { blockhashData, hammingDistance } from './blockhash-js';
import jpeg from 'jpeg-js';
import fs from 'fs';

function getScreenshotFromSource(
  source: Electron.DesktopCapturerSource,
  areaRect: Square
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
    source,
  };

  console.log(
    'Captured screenshot: len=' +
      sizeKb +
      'kb, size=' +
      size.width +
      'x' +
      size.height
  );

  return screenshot;
}

function findCapturerSourceByDisplay(
  sources: Electron.DesktopCapturerSource[],
  targetDisplay: Electron.Display,
  targetDisplayIndex: number
): Electron.DesktopCapturerSource {
  let screen = sources.find((s) => s.display_id == targetDisplay.id.toString());
  if (screen) {
    return screen;
  } else if (!screen && sources.length - 1 >= targetDisplayIndex) {
    return sources[targetDisplayIndex];
  } else {
    throw new Error('Screen was not found');
  }
}

async function captureScreenshot(
  areaRect: Square,
  activeScreen: Electron.Display,
  activeDisplayIndex: number
): Promise<IScreenshot> {
  const fullsize = activeScreen.bounds;

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: fullsize,
    fetchWindowIcons: false,
  });
  // register in shortcuts: videoStream.stop()
  const displaySource = findCapturerSourceByDisplay(
    sources,
    activeScreen,
    activeDisplayIndex
  );
  const screenshot = getScreenshotFromSource(displaySource, areaRect);
  return screenshot;
}

// returns true of other displays has negative x bounds
function primaryDisplayIsRight(allDisplays: Electron.Display[]): boolean {
  return !!allDisplays.find((d) => d.bounds.x < 0);
}

function getTempPath(): string {
  const fullPath = path.join(app.getPath('temp'), 'manuscrape');
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath);
  }
  return fullPath;
}

export async function saveAndCropVideo(
  video: ArrayBuffer,
  display: Electron.Display,
  allDisplays: Electron.Display[],
  area: Square
): Promise<string> {
  const path =
    getTempPath() +
    '/capture_' +
    new Date().toISOString().replace(/\:/g, '') +
    '.temp.webm';
  const resultPath =
    getTempPath() +
    '/capture_' +
    new Date().toISOString().replace(/\:/g, '') +
    '.webm';
  const displayIsRight = primaryDisplayIsRight(allDisplays);

  // save raw video (containing lots of stuff)
  fs.writeFileSync(path, Buffer.from(video));

  // crop file
  ipcMain.removeAllListeners('video-capture-done');
  console.log(
    'incorporating display bounds in area value. Original area:',
    area
  );

  // Handles x bounds for multi monitor setups.
  //
  // NOTE: as full recording captures one video with all screens, we are only interested
  // in adjusting the horizontal crop position
  if (!displayIsRight && allDisplays.length > 1) {
    area.x = display.workArea.x + area.x;
    area.y = display.workArea.y + area.y;
  } else if (displayIsRight && allDisplays.length > 1) {
    const leftScreen = allDisplays.find(
      (d) => d.id !== display.id && d.bounds.x < display.bounds.x
    );
    if (leftScreen) {
      const leftScreenWidth = leftScreen?.bounds.width;
      area.x += leftScreenWidth;
    }
  }

  await cropVideoFile(path, resultPath, area);

  return resultPath;
}

export async function saveScreenshot(
  filename: string,
  buffer: string | NodeJS.ArrayBufferView,
  directory?: string | undefined
): Promise<string> {
  let basepath = getTempPath();

  if (directory) {
    basepath = path.join(basepath, directory);
    fs.mkdirSync(basepath, { recursive: true });
  }

  const filepath = path.join(
    basepath,
    filename + '.' + new Date().toISOString().replace(/\:/g, '') + '.jpg'
  );
  fs.writeFileSync(filepath, buffer);
  console.log("Saved screenshot to file '" + filepath + "'");
  return filepath;
}

export async function quickScreenshot(
  area: Square,
  display: Electron.Display,
  displayIndex: number,
  _isCancelled: () => boolean
): Promise<string> {
  const screenshot = await captureScreenshot(area, display, displayIndex);
  const path = await saveScreenshot(screenshot.source.name, screenshot.buffer);
  return path;
}

export async function captureScrollshot(
  area: Square,
  display: Electron.Display,
  displayIndex: number,
  isCancelled: () => boolean
): Promise<{
  dirname: string;
  lastSavePath: string;
  totalScreenshots: number;
}> {
  const maxScreenshots = 512;
  const maxRepeatedScreenshots = 50;
  const minimumCaptureDelay = 428;
  const hammeringDiffThreshold = 1000;
  const scrollShotId = new Date().getTime();
  const dirname = scrollShotId.toString();

  let repeatedScreenshots = 0;
  let lastSavePath: string = '';
  let userIsDone = false;
  let lastImageHash = null;
  let totalScreenshots = 0;

  // change shortcut so it saves instead of initiating a scrollshot
  globalShortcut.unregister('Alt+S');
  globalShortcut.register('Alt+S', () => (userIsDone = true));

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
    const { source, buffer } = await captureScreenshot(
      area,
      display,
      displayIndex
    );
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
    } else if (
      !lastImageHash ||
      (imageDiff && imageDiff > hammeringDiffThreshold)
    ) {
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

  return { dirname, lastSavePath, totalScreenshots };
}

export async function processScrollshot(
  dirname: string,
  lastSavePath: string,
  totalScreenshots: number,
  settings: ScrollshotSettings,
  isCancelled: () => boolean
): Promise<string> {
  const resultImageDir = path.join(app.getPath('userData'), dirname, 'output');
  const resultImagePath = path.join(resultImageDir, 'result.png');

  // create directory for the joined image
  fs.mkdirSync(resultImageDir, { recursive: true });

  // if there are more than one screenshot, join the images and return path
  if (totalScreenshots > 1) {
    const screenshotsPath = path.join(getTempPath(), dirname);

    try {
      await joinImagesVertically(screenshotsPath, resultImagePath, settings);
      return resultImagePath;
    } catch (err) {
      new Notification({
        title: 'Unable to process scrollshot :(',
        body: 'Please scroll slowly either up or down',
        icon: errorIcon,
      }).show();
      throw new Error('Unable to join scrollshot images to one single image');
      // TODO: report error
    } finally {
      // remove all the single screenshots no matter if it went well joining them
      fs.rmSync(screenshotsPath, { recursive: true });
    }
  }
  // else if there is only one image, return its path
  else if (totalScreenshots === 1 && lastSavePath) {
    return lastSavePath;
  } else if (isCancelled()) {
    throw new Error('Cancelled');
  } else {
    throw new Error('Unable to save scroll shot!');
  }
}
