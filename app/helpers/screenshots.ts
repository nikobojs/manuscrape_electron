import { desktopCapturer, app } from 'electron';
import * as fs from 'fs'
import crypto from 'crypto';
import path from 'path';
import { sleepAsync } from './utils';
import { joinImagesVertically } from './pythonBridge';


function getScreenshotFromSource(
  source:
  Electron.DesktopCapturerSource,
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

  console.log('Captured screenshot: len=' + sizeKb + 'kb, size='+size.width+'x'+size.height);

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
): Promise<string> {
  const md5sums = [] as string[];
  const maxScreenshots = 512;
  const maxRepeatedScreenshots = 4;
  const minimumCaptureDelay = 500;
  let repeatedScreenshots = 0;
  const scrollShotId = new Date().getTime();
  const dirname = scrollShotId.toString();
  const resultImageDir = path.join(app.getPath('userData'), dirname, 'output');
  const resultImagePath = path.join(resultImageDir, 'result.png');

  for (let i = 0; i < maxScreenshots; i++) {
    const beforeCapture = new Date().getTime();

    const { source, buffer } = await captureScreenshot(areaRect, activeDisplay, activeDisplayIndex);
    console.log('capturing screenshot');

    const afterCapture = new Date().getTime();
    const captureTookMs = beforeCapture - afterCapture;
    const delay = Math.max(0, captureTookMs + minimumCaptureDelay);

    // TODO: use image hash that can measure similarity (hammering)
    const hash = crypto
      .createHash('md5')
      .update(buffer)
      .digest("base64");
      
    if (repeatedScreenshots > maxRepeatedScreenshots) {
      console.log('Scrolling screenshot stopped recording')
      break;
    } else if (!md5sums.includes(hash)) {
      repeatedScreenshots = 0;
      md5sums.push(hash);
      console.log('saving screenshot');
      await saveScreenshot(source.name, buffer, dirname);
    } else {
      repeatedScreenshots++;
    }

    await sleepAsync(delay);
  }

  fs.mkdirSync(resultImageDir, { recursive: true });

  await joinImagesVertically(
    path.join(getTempPath(), dirname),
    resultImagePath,
  );

  return resultImagePath;
}
