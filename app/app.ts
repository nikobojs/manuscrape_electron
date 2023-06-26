import { app, globalShortcut, ipcMain, desktopCapturer, screen } from 'electron';
import * as fs from 'fs'
import crypto from 'crypto';
import { setupTray, createTrayWindow } from './tray';
import { createOverlayWindow } from './overlay';

app.commandLine.appendSwitch('webrtc-max-cpu-consumption-percentage', '100')


app.whenReady().then(() => {
  // TODO NIKO: convert into one
  //ipcMain.on('quick-screenshot', quickScreenshot)
  //ipcMain.on('scroll-screenshot', scrollScreenshot)

  globalShortcut.register('Alt+Q', () => {
    console.log('Quitting ManuScrape...');
    app.exit(0)
  })

  // not working!
  // globalShortcut.register('Alt+N', () => createOverlayWindow());

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