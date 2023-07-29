const isLinux = process.platform === 'linux';

function pythonEntryBin() {
  const binDir = `./python/dist/`;
  const binFilename = `chatjoiner${isLinux ? '' : '.exe'}`;
  return binDir + binFilename;
}

module.exports = {
  packagerConfig: {
    asar: true,
    extraResource: [pythonEntryBin()],
    ignore: [
      /python\//
    ],
  },
  rebuildConfig: {
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
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
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
  ],
};
