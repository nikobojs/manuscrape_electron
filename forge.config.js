require("dotenv").config();
const isWindows = process.platform === "win32";
const path = require("path");
const debug = process.env.DEBUG === "1";

if (debug) {
  console.log("debug is enabled");
} else {
  console.log("debug is disabled");
}

function pythonEntryBin() {
  const binDir = `./python/dist/`;
  const binFilename = `chatjoiner${isWindows ? ".exe" : ""}`;
  return binDir + binFilename;
}

function ffmpegEntryBin() {
  const binDir = `./bin/`;
  const binFilename = `ffmpeg${isWindows ? ".exe" : ""}`;
  return binDir + binFilename;
}

if (debug) {
  console.log({
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_PASSWORD,
    appleTeamId: process.env.APPLE_TEAM_ID,
    windowsSignSha1: process.env.WINDOWS_SIGN_SHA1,
    windowsSignTimeServer: process.env.WINDOWS_SIGN_TIME,
  });
}

const doWindowsSign =
  process.platform === "win32" &&
  process.env.WINDOWS_SIGN_SHA1 &&
  process.env.WINDOWS_SIGN_TIME;
if (debug && process.platform === "win32") {
  console.log(
    doWindowsSign
      ? "will code sign the windows build"
      : "will NOT code sign the windows build",
  );
}

module.exports = {
  // docs: https://electron.github.io/packager/main/interfaces/electronpackager.options.html
  packagerConfig: {
    executableName: "manuscrape_electron",
    asar: true,
    overwrite: true,
    windowsSign: doWindowsSign
      ? {
          // signToolPath: `C:/Program Files (x86)/Windows Kits/10/bin/10.0.26100.0/x64/signtool.exe`,
          signWithParams: `/v /sha1 ${process.env.WINDOWS_SIGN_SHA1}`,
          hashes: ["sha256"],
          timestampServer: process.env.WINDOWS_SIGN_TIME,
        }
      : undefined,
    icon: path.resolve(__dirname, "assets", "icons", "desktop-icon.ico"),
    extraResource: [pythonEntryBin(), ffmpegEntryBin()],

    // This is to avoid following error on npm build on linux:
    // Error: /tmp/electron-packager/tmp-VyJyij/resources/app/python/env/bin/python:
    //        file "../../../../../usr/bin/python3.11" links out of the package
    // NOTE: but the error still happens in jenkins
    // NOTE: also works on linux when building for windows without
    ignore: [/python\//, /python3\.\d+$/, /python$/],
    //osxSign: {}, // object must exist even if empty (for MacOS code signing)
    osxSign: false, // TILFØJ DENNE LINJE
    osxNotarize: undefined,
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: (arch) => ({
        setupExe: `manuscrape-setup-${arch}.exe`,
        noMsi: true,
        title: "ManuScrape",
        signWithParams: doWindowsSign
          ? `/v /sha1 ${process.env.WINDOWS_SIGN_SHA1} /tr ${process.env.WINDOWS_SIGN_TIME} /td sha256 /fd sha256`
          : undefined,
        setupIcon: path.resolve(
          __dirname,
          "assets",
          "icons",
          "desktop-icon.ico",
        ),
        icon: path.resolve(__dirname, "assets", "icons", "desktop-icon.ico"),
      }),
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {
        icon: path.resolve(__dirname, "assets", "icons", "desktop-icon.icns"),
        format: "ULFO",
        name: "ManuScrape",
        overwrite: true,
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      executableName: "manuscrape_electron",
      config: {
        name: "ManuScrape",
        icon: path.resolve(__dirname, "assets", "icons", "desktop-icon.ico"),
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
  ],
  hooks: {
    packageAfterCopy: async (
      config,
      buildPath,
      electronVersion,
      platform,
      arch,
    ) => {
      console.log("Copying files is done! Current dirname is:\n", __dirname);
      if (debug) {
        console.log({ platform, arch, buildPath, electronVersion });
        console.log(
          "\nUsed following config:",
          JSON.stringify(config, null, 4),
        );
      }
    },
  },
};
