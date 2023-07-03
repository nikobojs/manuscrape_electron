import { desktopCapturer, app } from 'electron';
import * as fs from 'fs'
import crypto from 'crypto';
import path from 'path';
import { sleepAsync } from './utils';


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


export async function saveScreenshot(filename: string, buffer: string | NodeJS.ArrayBufferView): Promise<string> {
  const basepath = app.getPath('temp');
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
): Promise<void> {
  const screenshot = await captureScreenshot(areaRect, activeDisplay, activeDisplayIndex);
  await saveScreenshot(screenshot.source.name, screenshot.buffer);
}


// TODO: fix typing
export async function scrollScreenshot(
  areaRect: any,
  activeDisplay: Electron.Display,
  activeDisplayIndex: number,
): Promise<void> {
  const md5sums = [] as string[];
  const maxScreenshots = 512;
  const maxRepeatedScreenshots = 4;
  const minimumCaptureDelay = 500;
  let repeatedScreenshots = 0;

  for (let i = 0; i < maxScreenshots; i++) {
    const beforeCapture = new Date().getTime();

    const { source, buffer } = await captureScreenshot(areaRect, activeDisplay, activeDisplayIndex);

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
      await saveScreenshot(source.name, buffer);
    } else {
      repeatedScreenshots++;
    }

    await sleepAsync(delay);

  }
}
