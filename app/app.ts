import { app, globalShortcut } from 'electron';

// ask OS for a "single instance lock"
// if OS supports it, app will quit if launched as second instance
const obtainedLock = app.requestSingleInstanceLock();
if (!obtainedLock) {
  console.error('ManuScrape is already running. Will quit :/');
  app.quit();
}

// https://github.com/electron/windows-installer
const squirrelEvent = process.argv[1];
const isSquirrel = squirrelEvent && squirrelEvent.indexOf('--squirrel') != -1;

// run this as early in the main process as possible
// https://www.electronforge.io/config/makers/squirrel.windows
if (require('electron-squirrel-startup') || isSquirrel) {
  console.debug('closing app because of squirrel event:', squirrelEvent);
  app.quit();
}

import { ManuScrapeController } from './controller';
import { ensurePythonAvail } from './helpers/pythonBridge';
import { createTrayWindow } from './helpers/browserWindows';
import { warnIfEncryptionUnavailable } from './helpers/utils';
import { ensureFfmpegAvail } from './helpers/ffmpegBridge';

let controller: ManuScrapeController | undefined;

// force dark mode in chrome
app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');

// enable screen capturing using navigator.mediaDevices.getUserMedia
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');

// seems like the best thing to do
// NOTE: https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering
app.disableHardwareAcceleration();

app.whenReady().then(() => {
  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });

  // ensure compiled python executable is available
  // NOTE: this is required for both development and production environments
  // NOTE: to compile the python part of the app, read the docs ;)
  ensurePythonAvail();

  // ensure ffmpeg binaries are available
  ensureFfmpegAvail();

  // create hidden tray window
  // NOTE: this needs to exist for a lot of stuff to work
  const trayWindow = createTrayWindow();

  // ensure safeStorage works on this device
  // NOTE: must be run after first browser window is created
  const encryptionSupport = warnIfEncryptionUnavailable();

  // initialize controller object
  controller = new ManuScrapeController(trayWindow, encryptionSupport);
});

process.on('unhandledRejection', function (err) {
  console.error(err);
  process.exit(1);
});
