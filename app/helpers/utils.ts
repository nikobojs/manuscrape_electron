import { safeStorage } from "electron";

export function sleepAsync(ms: number | undefined) {
  return new Promise((ok) => setTimeout(ok, ms));
}

export function ensureEncryptionAvail(): void {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();
  if (!encryptionAvailable) {
    throw new Error('Your machine does not support safe login.')
  }
}