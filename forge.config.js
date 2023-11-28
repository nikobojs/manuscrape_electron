const isLinux = process.platform === 'linux';
const path = require('path');

function pythonEntryBin() {
  const binDir = `./python/dist/`;
  const binFilename = `chatjoiner${isLinux ? '' : '.exe'}`;
  return binDir + binFilename;
}

function ffmpegEntryBin() {
  const binDir = `./bin/`;
  const binFilename = `ffmpeg${isLinux ? '' : '.exe'}`;
  return binDir + binFilename;
}

module.exports = {
  packagerConfig: {
    executableName: 'manuscrape_electron',
    asar: true,
    icon: path.resolve(__dirname, 'assets', 'icons', 'desktop-icon.ico'),
    extraResource: [pythonEntryBin(), ffmpegEntryBin()],
    // TODO: whats the purpose of this?
    // ignore: [
    //   /python\//
    // ],
  },
  rebuildConfig: {
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: (arch) => ({
        // NOTE: EXPERIMENTAL
        setupExe: `manuscrape-setup-${arch}.exe`,
        noMsi: true,
        title: 'ManuScrape',

        setupIcon: path.resolve(__dirname, 'assets', 'icons', 'desktop-icon.ico'),
        icon: path.resolve(__dirname, 'assets', 'icons', 'desktop-icon.ico'),
        //
        // TODO: add certificate
        // certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
        // certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD
      }),
    },
    // {
    //   name: '@electron-forge/maker-zip',
    //   platforms: ['darwin'],
    // },
    // {
    //   name: '@electron-forge/maker-deb',
    //   config: {},
    // },
    {
      name: '@electron-forge/maker-rpm',
      executableName: 'manuscrape_electron',
      config: {
        name: 'ManuScrape',
        icon: path.resolve(__dirname, 'assets', 'icons', 'desktop-icon.ico'),
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
  ],
};
