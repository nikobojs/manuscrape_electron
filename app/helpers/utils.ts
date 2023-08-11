import { type MessageBoxOptions, dialog, safeStorage } from "electron";

export function sleepAsync(ms: number | undefined) {
  return new Promise((ok) => setTimeout(ok, ms));
}

export function ensureEncryptionAvail(): void {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();
  if (!encryptionAvailable) {
    throw new Error('Your machine does not support safe login.')
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