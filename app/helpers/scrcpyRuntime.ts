import { app } from "electron";
import path from "path";

export interface ScrcpyRuntimePaths {
  directory: string;
  adb: string;
  client: string;
  noConsoleClient?: string;
  server: string;
}

export interface AndroidDevice {
  serial: string;
  model: string;
  status: "device" | "offline" | "unauthorized";
  displayName?: string;
  description?: string;
}

export function parseAdbDevices(output: string): AndroidDevice[] {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(
      (parts) =>
        parts.length >= 2 &&
        ["device", "offline", "unauthorized"].includes(parts[1]),
    )
    .map((parts) => {
      const modelPart = parts.find((part) => part.startsWith("model:"));
      const model = modelPart
        ? modelPart.slice("model:".length).replace(/_/g, " ")
        : "Android phone";

      return {
        serial: parts[0],
        model,
        status: parts[1] as AndroidDevice["status"],
      };
    });
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
    noConsoleClient:
      process.platform === "win32"
        ? path.join(directory, "scrcpy-noconsole.vbs")
        : undefined,
    server: path.join(directory, "scrcpy-server"),
  };
}
