import { app, globalShortcut } from 'electron';
import { createTrayWindow, setupTray } from './tray';

// required to keep the app running
let trayWindow;

app.whenReady().then(() => {
  globalShortcut.register('Alt+Q', () => {
    console.log('Quitting ManuScrape...');
    app.exit(0)
  })

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
  });

  app.on('will-quit', (e) => {
    globalShortcut.unregisterAll();
    console.log('bye', e);
  })

  setupTray();
  trayWindow = createTrayWindow();
});

process.on('unhandledRejection', function (err) {
   console.error(err);
   process.exit(1);
});