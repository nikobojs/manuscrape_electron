import { app, globalShortcut } from 'electron';
import { ManuScrapeController } from './controller';

let controller;

app.whenReady().then(() => {
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