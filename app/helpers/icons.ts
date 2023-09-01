import path from 'path';
import { nativeImage } from 'electron';

function loadImage(fullPath: string): Electron.NativeImage {
    return nativeImage.createFromPath(fullPath);
}

export const addIcon = loadImage(path.join(__dirname, "../../assets/icons/add.png"));
export const trayIcon = loadImage(path.join(__dirname, "../../assets/tray.png"));
export const loginIcon = loadImage(path.join(__dirname, "../../assets/icons/login.png"));
export const logoutIcon = loadImage(path.join(__dirname, "../../assets/icons/logout.png"));
export const monitorIcon = loadImage(path.join(__dirname, "../../assets/icons/monitor.png"));
export const quitIcon = loadImage(path.join(__dirname, "../../assets/icons/quit.png"));
export const folderIcon = loadImage(path.join(__dirname, "../../assets/icons/folder.png"));
export const bugReportIcon = loadImage(path.join(__dirname, "../../assets/icons/bug_report.png"));

export const errorIcon = loadImage(path.join(__dirname, "../../assets/icons/error.png"));
export const warningIcon = loadImage(path.join(__dirname, "../../assets/icons/warning.png"));
export const successIcon = loadImage(path.join(__dirname, "../../assets/icons/success.png"));