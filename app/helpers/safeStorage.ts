import fs from 'node:fs';
import { safeStorage } from 'electron';

export function fileExists(p: string): boolean {
  return fs.existsSync(p);
}

// NOTE: safeStorage's sync API was deprecated in electron 45 and will be
// removed in a future release — always use the async variants here
export async function readFile(p: string): Promise<string> {
  const encrypted = fs.readFileSync(p);
  const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(
    encrypted,
  );
  if (shouldReEncrypt) {
    // the encryption key was rotated — persist the content with the new key
    await saveFile(result, p);
  }
  return result;
}

export async function saveFile(content: string, p: string): Promise<void> {
  const encrypted = await safeStorage.encryptStringAsync(content);
  fs.writeFileSync(p, encrypted);
}

export function deleteFile(p: string): void {
  try {
    fs.unlinkSync(p);
  } catch(err: any) {
    if (err?.code == 'ENOENT') {
      // ignore if file doesn't exist, because if file was
      // "already deleted" the function still did its job, right?
    } else {
      throw err;
    }
  }
}
