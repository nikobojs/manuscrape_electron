import { app, globalShortcut, safeStorage } from 'electron';

// run this as early in the main process as possible
// https://www.electronforge.io/config/makers/squirrel.windows
if (require('electron-squirrel-startup')) app.quit();

import { ManuScrapeController } from './controller';
import { ensurePythonAvail } from './helpers/pythonBridge';
import { createTrayWindow } from './helpers/browserWindows';
import { ensureEncryptionAvail } from './helpers/utils';

let controller;

app.whenReady().then(() => {

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
  });

  app.on('will-quit', (e) => {
    globalShortcut.unregisterAll();
    console.log('bye', e);
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
  controller = new ManuScrapeController(app, trayWindow);
});

process.on('unhandledRejection', function (err) {
   console.error(err);
   process.exit(1);
});
