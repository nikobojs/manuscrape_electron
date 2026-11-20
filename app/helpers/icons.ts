import path from "path";
import { nativeImage, nativeTheme } from "electron";

const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";

function loadImage(fullPath: string): Electron.NativeImage {
  const image = nativeImage.createFromPath(fullPath);
  if (image.isEmpty()) {
    console.error(`Unable to load image: ${fullPath}`);
  }
  return image;
}

export function getMainIconPathBasedOnOS() {
  if (isWindows) {
    return path.join(__dirname, "../../assets/icons/desktop-icon.ico");
  } else if (isMac) {
    return path.join(__dirname, "../../assets/icons/desktop-icon.icns");
  } else {
    return path.join(__dirname, "../../assets/icons/desktop-icon.png");
  }
}

export interface MenuIcons {
  add: Electron.NativeImage;
  login: Electron.NativeImage;
  logout: Electron.NativeImage;
  monitor: Electron.NativeImage;
  quit: Electron.NativeImage;
  folder: Electron.NativeImage;
  bugReport: Electron.NativeImage;
  openInNew: Electron.NativeImage;
  settings: Electron.NativeImage;
}

// Menu icons come in two color variants, because the native tray menu
// follows the OS theme: light glyphs for dark menus, dark glyphs for
// light menus. Both variants share the same alpha anti-aliasing.
const menuIconNames = [
  "add",
  "login",
  "logout",
  "monitor",
  "quit",
  "folder",
  "bug_report",
  "open_in_new",
  "settings",
] as const;

function loadMenuIconSet(variant: "light" | "dark"): MenuIcons {
  const dir = path.join(__dirname, "../../assets/icons");
  const icons = {} as Record<string, Electron.NativeImage>;
  for (const name of menuIconNames) {
    icons[name] = loadImage(
      path.join(dir, variant === "dark" ? "dark" : "", `${name}.png`),
    );
  }
  return {
    add: icons.add,
    login: icons.login,
    logout: icons.logout,
    monitor: icons.monitor,
    quit: icons.quit,
    folder: icons.folder,
    bugReport: icons.bug_report,
    openInNew: icons.open_in_new,
    settings: icons.settings,
  };
}

// Loaded once; both variants are cheap 16x16 images
const lightMenuIcons = loadMenuIconSet("light");
const darkMenuIcons = loadMenuIconSet("dark");

// Return the menu icons matching the current OS theme.
// Defaults to the dark set: when the theme cannot be determined,
// nativeTheme.shouldUseDarkColors is false, which yields dark icons.
export function getMenuIcons(): MenuIcons {
  return nativeTheme.shouldUseDarkColors ? lightMenuIcons : darkMenuIcons;
}

// NOTE: image is way to large
// TODO: Fix for windows & GNOME
// macOS uses the logo at 19px; the @2x variant next to it is used
// automatically on retina displays
export const trayIcon = loadImage(
  path.join(
    __dirname,
    "../../assets",
    isMac ? "tray_20px_srgb.png" : "tray_small.png",
  ),
);

export const errorIcon = loadImage(
  path.join(__dirname, "../../assets/icons/error.png"),
);
export const warningIcon = loadImage(
  path.join(__dirname, "../../assets/icons/warning.png"),
);
export const successIcon = loadImage(
  path.join(__dirname, "../../assets/icons/success.png"),
);
