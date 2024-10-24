import path from 'path';
import { app } from 'electron';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

function getFfmpegPath(): string {
  const isWindows = process.platform === 'win32';
  const filename = isWindows ? 'ffmpeg.exe' : 'ffmpeg';
  const isPackaged = app.isPackaged;

  if (isPackaged) {
    return path.join(process.resourcesPath, filename);
  } else {
    return path.join(__dirname, '..', '..', 'bin', filename);
  }
}

export function ensureFfmpegAvail(): void {
  const p = getFfmpegPath();
  const exists = fs.existsSync(p);
  if (!exists) {
    console.error('Invalid ffmpeg.exe path:', p);
    throw new Error(
      'ManuScrape Electron app could not find the internal ffmpeg utilities'
    );
  }
}
