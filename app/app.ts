import { app, globalShortcut, safeStorage } from 'electron';

// run this as early in the main process as possible
// https://www.electronforge.io/config/makers/squirrel.windows
if (require('electron-squirrel-startup')) app.quit();

import { ManuScrapeController } from './controller';
import { ensurePythonAvail } from './helpers/pythonBridge';

let controller;

app.whenReady().then(() => {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();

  if (!encryptionAvailable) {
    throw new Error('Your machine does not support safe login.')
  }

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
  });

  app.on('will-quit', (e) => {
    globalShortcut.unregisterAll();
    console.log('bye', e);
  })

  console.log('platform:', process.platform)

  // ensure compiled python executable is available
  // NOTE: this is required for both development and production environments
  // NOTE: to compile the python part of the app, read the docs ;)
  ensurePythonAvail();

  controller = new ManuScrapeController(app);
});

process.on('unhandledRejection', function (err) {
   console.error(err);
   process.exit(1);
});
