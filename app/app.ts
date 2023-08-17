import { BrowserWindow, app, globalShortcut } from 'electron';

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
import { ensureEncryptionAvail } from './helpers/utils';

let controller: ManuScrapeController | undefined;

// force dark mode in chrome
app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');

app.whenReady().then(() => {

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
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
  ensureEncryptionAvail();

  // initialize controller object
  controller = new ManuScrapeController(trayWindow);
});

process.on('unhandledRejection', function (err) {
   console.error(err);
   process.exit(1);
});
