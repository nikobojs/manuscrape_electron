const isWindows = process.platform === 'win32';
const path = require('path');

function pythonEntryBin() {
  const binDir = `./python/dist/`;
  const binFilename = `chatjoiner${isWindows ? '.exe' : ''}`;
  return binDir + binFilename;
}

function ffmpegEntryBin() {
  const binDir = `./bin/`;
  const binFilename = `ffmpeg${isWindows ? '.exe' : ''}`;
  return binDir + binFilename;
}

module.exports = {
  // docs: https://electron.github.io/packager/main/interfaces/electronpackager.options.html
  packagerConfig: {
    executableName: 'manuscrape_electron',
    asar: true,
    overwrite: true,
    icon: path.resolve(__dirname, 'assets', 'icons', 'desktop-icon.ico'),
    extraResource: [pythonEntryBin(), ffmpegEntryBin()],

    // This is to avoid following error on npm build on linux:
    // Error: /tmp/electron-packager/tmp-VyJyij/resources/app/python/env/bin/python:
    //        file "../../../../../usr/bin/python3.11" links out of the package
    // NOTE: but the error still happens in jenkins
    // NOTE: also works on linux when building for windows without
    ignore: [/python\//, /python3\.\d+$/, /python$/],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: (arch) => ({
        setupExe: `manuscrape-setup-${arch}.exe`,
        noMsi: true,
        title: 'ManuScrape',

        setupIcon: path.resolve(
          __dirname,
          'assets',
          'icons',
          'desktop-icon.ico'
        ),
        icon: path.resolve(__dirname, 'assets', 'icons', 'desktop-icon.ico'),
      }),
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        icon: path.resolve(__dirname, 'assets', 'icons', 'desktop-icon.png'),
        format: 'ULFO',
        name: 'ManuScrape',
        overwrite: true,
      },
    },
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
  hooks: {
    packageAfterCopy: async (
      config,
      buildPath,
      electronVersion,
      platform,
      arch
    ) => {
      console.log('Copying files is done! Current dirname is:\n', __dirname);
      console.log({ platform, arch, buildPath, electronVersion });
      console.log(JSON.stringify(config, null, 4));
    },
  },
};
