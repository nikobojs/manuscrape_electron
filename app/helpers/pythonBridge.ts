import path from "path";
import { app } from "electron";
import fs from "node:fs";
import { spawn } from "node:child_process";

function getChatJoinerPath(): string {
  const isPackaged = app.isPackaged;
  const isWindows = process.platform === "win32";
  const filename = isWindows ? "chatjoiner.exe" : "chatjoiner";

  if (isPackaged) {
    return path.join(process.resourcesPath, filename);
  }

  return path.join(__dirname, "..", "..", "python", "dist", filename);
}

export function ensurePythonAvail(): void {
  const p = getChatJoinerPath();
  const exists = fs.existsSync(p);
  if (!exists) {
    console.error("Invalid path to chatjoiner executable:", p);
    throw new Error(
      "ManuScrape Electron app could not find the internal python utilities"
    );
  }
}

export function joinImagesVertically(
  imagesDir: string,
  outputPath: string,
  settings: ScrollshotSettings
): Promise<void> {
  console.log("starting to join images...");
  return new Promise((resolve, reject) => {
    const chatjoinerPath = getChatJoinerPath();

    const beginTime = new Date().getTime();
    const args = [
      imagesDir,
      "--n_rows_in_crop",
      "" + settings.rowsPrCrop,
      "--n_cols_in_crop",
      "" + settings.colsPrCrop,
      "--denoising_factor",
      "" + settings.denoisingFactor,
      "--match_score_threshold",
      "" + settings.matchScoreThreshold,
      "--left_crop_from",
      "" + settings.leftCropFrom,
      "--right_crop_from",
      "" + settings.rightCropFrom,
      "--left_crop_to",
      "" + settings.leftCropTo,
      "--right_crop_to",
      "" + settings.rightCropTo,
      "-o",
      outputPath,
    ];
    const python = spawn(chatjoinerPath, args);

    const debugCmd = chatjoinerPath + args.join(" ");
    console.info("> " + debugCmd);

    python.stdout.on("data", function (data: string) {
      console.info(data);
    });

    python.stderr.on("data", (data: string) => {
      console.error(`stderr: ${data}`);
      console.log(`stderr: ${data}`);
    });

    python.on("close", (code: number) => {
      console.info("python program exited with code", code);
      if (code === 0) {
        console.log("saved result image:", outputPath);
        console.log(
          "python program took",
          ((new Date().getTime() - beginTime) / 1000).toFixed(2) + "s"
        );
        resolve();
      } else {
        reject();
      }
    });
  });
}
