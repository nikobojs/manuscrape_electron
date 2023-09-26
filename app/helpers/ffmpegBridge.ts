import path from 'path';
import { app } from 'electron';
import fs from 'node:fs';
import { spawn } from 'node:child_process'

function getFfmpegPath(): string {
    const isWindows = process.platform === 'win32'
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
        throw new Error('ManuScrape Electron app could not find the internal ffmpeg utilities');
    }
}

export function cropVideoFile(
  filepath: string,
  outputPath: string,
  area: {
    width: number,
    height: number,
    x: number,
    y: number,
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = getFfmpegPath();
    console.log('AREA:', area)
    const { width, height, x, y } = area;
    const beginTime = new Date().getTime();
    const cmd = [
      '-i',
      filepath,
      '-vf',
      `crop=${width}:${height}:${x}:${y}`,
      '-threads',
      '5',
      '-preset',
      'ultrafast',
      '-strict',
      '-2',
      outputPath,
    ];
    const process = spawn(ffmpeg, cmd);

    process.on("close", (code: number) => {
        fs.unlinkSync(filepath);
        if (code === 0) {
            console.log('ffmpeg program took', ((new Date().getTime() - beginTime) / 1000).toFixed(2) + 's')
            resolve();
        } else {
            console.info('ffmpeg program exited with code', code);
            reject();
        }
    });
  })
}