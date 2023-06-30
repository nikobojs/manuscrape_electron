import { app, globalShortcut } from 'electron';
import { setupTray, createTrayWindow } from './tray';

app.whenReady().then(() => {
  globalShortcut.register('Alt+Q', () => {
    console.log('Quitting ManuScrape...');
    app.exit(0)
  })

  createTrayWindow();
  setupTray();

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    console.log('bye');
  })
});