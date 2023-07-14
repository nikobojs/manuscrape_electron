import { app, globalShortcut, safeStorage } from 'electron';
import { ManuScrapeController } from './controller';

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

  controller = new ManuScrapeController(app);
});

process.on('unhandledRejection', function (err) {
   console.error(err);
   process.exit(1);
});