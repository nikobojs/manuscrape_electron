import fs from 'node:fs';
import { safeStorage } from 'electron';

export function fileExists(p: string): boolean {
  return fs.existsSync(p);
}

export function readFile(p: string): string {
  const encrypted = fs.readFileSync(p);
  const host = safeStorage.decryptString(encrypted);
  return host;
}

export function saveFile(content: string, p: string): void {
  const encrypted = safeStorage.encryptString(content);
  fs.writeFileSync(p, encrypted);
}

export function deleteFile(p: string): void {
  fs.unlinkSync(p);
}