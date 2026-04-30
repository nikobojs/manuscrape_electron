import { app, globalShortcut, dialog } from "electron";

// ask OS for a "single instance lock"
// if OS supports it, app will quit if launched as second instance
const obtainedLock = app.requestSingleInstanceLock();
if (!obtainedLock) {
  console.error("ManuScrape is already running. Will quit :/");
  app.quit();
}

import { ManuScrapeController } from "./controller";
import { ensurePythonAvail } from "./helpers/pythonBridge";
import { createTrayWindow, createSplashWindow } from "./helpers/browserWindows";
import {
  parseSquirrelArgs,
  warnIfEncryptionUnavailable,
} from "./helpers/utils";
import { ensureFfmpegAvail } from "./helpers/ffmpegBridge";

// https://github.com/electron/windows-installer
// https://www.electronforge.io/config/makers/squirrel.windows
// `squirrelEvent` will be defined if squirrel args could be detected and parsed
const squirrelEvent = parseSquirrelArgs(process.argv);

let controller: ManuScrapeController | undefined;

if (!squirrelEvent) {
  // force dark mode in chrome
  app.commandLine.appendSwitch("enable-features", "WebContentsForceDark");

  // enable screen capturing using navigator.mediaDevices.getUserMedia
  app.commandLine.appendSwitch("enable-usermedia-screen-capturing");

  // disable dns watcher (handles app dns cache on network changes, but causes hangs)
  app.commandLine.appendSwitch("disable-features", "DnsConfigWatch");

  // seems like the best thing to do
  // NOTE: https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering
  app.disableHardwareAcceleration();
}

const appName = `ManuScrape v${app.getVersion()}`;

app.whenReady().then(() => {
  // add dialogs when install/update/uninstall
  // TODO: test on windows
  // https://www.electronforge.io/config/makers/squirrel.windows
  if (squirrelEvent) {
    if (squirrelEvent === "install") {
      app.quit();
      return;
    } else if (squirrelEvent === "firstrun") {
      // experiment to let this run
      // TODO: revise on windows!
      dialog.showMessageBoxSync({
        title: "Install/update status",
        message: `${appName} was successfully updated/installed`,
      });
    } else if (squirrelEvent === "uninstall") {
      dialog.showMessageBoxSync({
        title: "Install/update status",
        message: `${appName} was successfully uninstalled`,
      });
      app.quit();
      return;
    } else {
      dialog.showMessageBoxSync({
        title: "Error",
        message: `There is no handling of squirrel event: ${squirrelEvent}`,
      });
      app.quit();
      return;
    }
  }

  // show splash immediately — destroyed once the controller signals ready
  const splashWindow = createSplashWindow();

  app.on("window-all-closed", function () {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("will-quit", () => {
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
  controller = new ManuScrapeController(
    trayWindow,
    encryptionSupport,
    app.getVersion(),
    () => splashWindow.destroy(),
  );
});

process.on("unhandledRejection", function (err) {
  console.error(err);
  process.exit(1);
});
