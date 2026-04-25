import os from "os";

// available at: https://github.com/sindresorhus/macos-release/blob/main/index.js
const macDarwinVersionMap = new Map([
  [25, ["Tahoe", "26"]],
  [24, ["Sequoia", "15"]],
  [23, ["Sonoma", "14"]],
  [22, ["Ventura", "13"]],
  [21, ["Monterey", "12"]],
  [20, ["Big Sur", "11"]],
  [19, ["Catalina", "10"]],
  [18, ["Mojave", "10"]],
  [17, ["High Sierra", "10"]],
  [16, ["Sierra", "10"]],
  [15, ["El Capitan", "10"]],
  [14, ["Yosemite", "10"]],
  [13, ["Mavericks", "10"]],
  [12, ["Mountain Lion", "10"]],
  [11, ["Lion", "10"]],
  [10, ["Snow Leopard", "10"]],
  [9, ["Leopard", "10"]],
  [8, ["Tiger", "10"]],
  [7, ["Panther", "10"]],
  [6, ["Jaguar", "10"]],
  [5, ["Puma", "10"]],
]);

export function isMac(): boolean {
  return process.platform === "darwin";
}

export function hasMinimumMacVersion(targetMacOsVersion: number): boolean {
  const v = os.version();
  if (!isMac()) {
    return false;
  }
  const macKernelMatch = /Darwin Kernel Version ([\d\.])+/.exec(v);
  if (!macKernelMatch) {
    // TODO: report error
    console.error("Kernel info does not seem to contain any version:", v);
    return false;
  }
  const kernelVersion = parseInt(/\d+/.exec(macKernelMatch[0])?.[0] || "");
  if (isNaN(kernelVersion)) {
    // TODO: report error
    console.error("Kernel version could not be determined");
    return false;
  }
  const majorVersion = parseInt(
    macDarwinVersionMap.get(kernelVersion)?.[1] || "",
  );
  if (isNaN(majorVersion)) {
    // TODO: report error
    console.error("Major version could not be determined");
    return false;
  }

  return majorVersion >= targetMacOsVersion;
}
