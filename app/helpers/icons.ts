import path from 'path';
import { nativeImage } from 'electron';

function loadImage(fullPath: string): Electron.NativeImage {
  return nativeImage.createFromPath(fullPath);
}

export function getMainIconPathBasedOnOS() {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWindows) {
    return path.join(__dirname, '../../assets/icons/desktop-icon.ico');
  } else if (isMac) {
    return path.join(__dirname, '../../assets/icons/desktop-icon.icns');
  } else {
    return path.join(__dirname, '../../assets/icons/desktop-icon.png');
  }
}

export const addIcon = loadImage(
  path.join(__dirname, '../../assets/icons/add.png')
);
export const trayIcon = loadImage(
  path.join(__dirname, '../../assets/tray.png')
);
export const loginIcon = loadImage(
  path.join(__dirname, '../../assets/icons/login.png')
);
export const logoutIcon = loadImage(
  path.join(__dirname, '../../assets/icons/logout.png')
);
export const monitorIcon = loadImage(
  path.join(__dirname, '../../assets/icons/monitor.png')
);
export const quitIcon = loadImage(
  path.join(__dirname, '../../assets/icons/quit.png')
);
export const folderIcon = loadImage(
  path.join(__dirname, '../../assets/icons/folder.png')
);
export const bugReportIcon = loadImage(
  path.join(__dirname, '../../assets/icons/bug_report.png')
);
export const openInNewIcon = loadImage(
  path.join(__dirname, '../../assets/icons/open_in_new.png')
);
export const settingsIcon = loadImage(
  path.join(__dirname, '../../assets/icons/settings.png')
);

export const errorIcon = loadImage(
  path.join(__dirname, '../../assets/icons/error.png')
);
export const warningIcon = loadImage(
  path.join(__dirname, '../../assets/icons/warning.png')
);
export const successIcon = loadImage(
  path.join(__dirname, '../../assets/icons/success.png')
);
