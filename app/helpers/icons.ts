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