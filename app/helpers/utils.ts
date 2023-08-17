import { type MessageBoxOptions, dialog, safeStorage, Notification } from "electron";
import { errorIcon } from "./icons";

export function sleepAsync(ms: number | undefined) {
  return new Promise((ok) => setTimeout(ok, ms));
}

export function ensureEncryptionAvail(): void {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();
  if (!encryptionAvailable) {
    const err = new Error('Your machine does not support safe login. Your login sessions will not be saved')
    new Notification({
      title: 'ManuScrape',
      body: err.message,
      icon: errorIcon,
    }).show();
    throw err;
  }
}

export async function yesOrNo(
  message: string
): Promise<boolean> {
  const options: MessageBoxOptions = {
    title: 'Awaiting your confirmation',
    buttons: ['&Yes', '&No', '&Cancel'],
    message,
    type: 'warning',
    normalizeAccessKeys: true,
    cancelId: 2
  };

  const { response } = await dialog.showMessageBox(options);

  return response == 0; // Yes button is pressed
}