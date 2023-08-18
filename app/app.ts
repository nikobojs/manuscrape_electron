import { app, globalShortcut } from 'electron';
import { ManuScrapeController } from './controller';
import { ensurePythonAvail } from './helpers/pythonBridge';
import { createTrayWindow } from './helpers/browserWindows';
import { warnIfEncryptionUnavailable, yesOrNo } from './helpers/utils';

// https://github.com/electron/windows-installer
const squirrelEvent = process.argv[1];
const isSquirrel = squirrelEvent && squirrelEvent.indexOf('--squirrel') != -1;

// run this as early in the main process as possible
// https://www.electronforge.io/config/makers/squirrel.windows
if (require('electron-squirrel-startup') || isSquirrel) {
  console.debug('closing app because of squirrel event:', squirrelEvent);

  // ask if user want to keep running manuscrape after update or install from setup file
  let keepRunning = false;
  if (squirrelEvent === '--squirrel-updated') {
    keepRunning = yesOrNo('ManuScrape successfully updated. To you want to start it now?')
  } else if (squirrelEvent == '--squirrel-install') {
    keepRunning = yesOrNo('ManuScrape successfully installed. To you want to start it now?')
  }

  // quit app early
  if (!keepRunning){
    app.quit()
  }
}

let controller: ManuScrapeController | undefined;

// force dark mode in chrome
app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');

app.whenReady().then(() => {

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  })

  // ensure compiled python executable is available
  // NOTE: this is required for both development and production environments
  // NOTE: to compile the python part of the app, read the docs ;)
  ensurePythonAvail();

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
