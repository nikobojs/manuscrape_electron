import { type MessageBoxOptions, dialog, safeStorage, Notification, systemPreferences } from "electron";
import { warningIcon } from "./icons";


export function sleepAsync(ms: number | undefined) {
  return new Promise((ok) => setTimeout(ok, ms));
}


export function warnIfEncryptionUnavailable(): boolean {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();
  if (!encryptionAvailable) {
    const err = new Error('Your machine does not support safe login. Your login sessions will not be saved')
    new Notification({
      title: 'ManuScrape',
      body: err.message,
      icon: warningIcon,
    }).show();
  }
  return encryptionAvailable;
}


export function yesOrNo(
  message: string
): boolean {
  const options: MessageBoxOptions = {
    title: 'Awaiting your confirmation',
    buttons: ['&Yes', '&No', '&Cancel'],
    message,
    type: 'warning',
    normalizeAccessKeys: true,
    cancelId: 2
  };

  const response = dialog.showMessageBoxSync(options);

  return response == 0; // Yes button is pressed
}

// This is important for macOS 10.15 Catalina or higher
export function warnIfScreenIsNotAccessible(): boolean {
  const screenAccessGranted = systemPreferences.getMediaAccessStatus('screen');
  const isScreenAccessible = screenAccessGranted === "granted"
  
  if (!isScreenAccessible) {
    const err = new Error('Go to System Preferences and give app screen recording permission');
    new Notification({
      title: 'ManuScrape',
      body: err.message,
      icon: warningIcon,
    }).show();
  }  
  
  return isScreenAccessible
}
