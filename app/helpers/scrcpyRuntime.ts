import { app } from "electron";
import path from "path";

export interface ScrcpyRuntimePaths {
  directory: string;
  adb: string;
  client: string;
  server: string;
}

export function parseAdbDevices(output: string): string[] {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 2 && parts[1] === "device")
    .map((parts) => parts[0]);
}

const platformDirectories: Record<string, string> = {
  "darwin-arm64": "macos-arm64",
  "darwin-x64": "macos-x64",
  "linux-x64": "linux-x64",
  "win32-x64": "windows-x64",
};

export function getScrcpyRuntimePaths(): ScrcpyRuntimePaths {
  const platformKey = `${process.platform}-${process.arch}`;
  const platformDirectory = platformDirectories[platformKey];

  if (!platformDirectory) {
    throw new Error(`Unsupported scrcpy platform: ${platformKey}`);
  }

  const directory = app.isPackaged
    ? path.join(process.resourcesPath, "scrcpy-runtime")
    : path.join(
        app.getAppPath(),
        "bin",
        platformDirectory,
        "scrcpy-runtime",
      );
  const executableExtension = process.platform === "win32" ? ".exe" : "";

  return {
    directory,
    adb: path.join(directory, `adb${executableExtension}`),
    client: path.join(directory, `scrcpy${executableExtension}`),
    server: path.join(directory, "scrcpy-server"),
  };
}
