import { contextBridge, ipcRenderer } from 'electron';

// console.log('version:', process.env.npm_package_version) (THIS WORKS)

let recorder: MediaRecorder | undefined;

contextBridge.exposeInMainWorld('electronAPI', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  projectCreated: (project: any) => {
    ipcRenderer.send('project-created', project);
  },
  observationCreated: (project: any) => {
    ipcRenderer.send('observation-created', project);
  },
  areaMarked: (...args: any) => {
    ipcRenderer.send('area-marked', ...args);
  },
  signIn: (
    signInBody: ISignInBody,
    callback: SignInCallback,
    callbackError: SignInCallback
  ) => {
    ipcRenderer.once('sign-in-ok', callback);
    ipcRenderer.once('sign-in-error', callbackError);
    ipcRenderer.send('sign-in', signInBody);
  },
  signUp: (
    signInBody: ISignUpBody,
    callback: SignInCallback,
    callbackError: SignUpCallback
  ) => {
    ipcRenderer.once('sign-up-ok', callback);
    ipcRenderer.once('sign-up-error', callbackError);
    ipcRenderer.send('sign-up', signInBody);
  },
  updateSettings: (
    settingsBody: ISettings,
    callback: UpdateSettingsCallback,
    callbackError: UpdateSettingsCallback
  ) => {
    ipcRenderer.once('update-settings-ok', callback);
    ipcRenderer.once('update-settings-error', callbackError);
    ipcRenderer.send('update-settings', settingsBody);
  },
  defaultHostValue: (callback: HostValueCallback) => {
    ipcRenderer.once('default-host-value', callback);
    ipcRenderer.once('ask-for-default-host-value', callback); // TODO: is this one needed?
    ipcRenderer.send('ask-for-default-host-value');
  },
  getSettings: (callback: HostValueCallback) => {
    ipcRenderer.once('get-settings-response', callback);
    ipcRenderer.send('get-settings-request');
  },
  getDefaultSettings: (callback: HostValueCallback) => {
    ipcRenderer.once('get-default-settings-response', callback);
    ipcRenderer.send('get-default-settings-request');
  },
  onStatus: (callback: MarkAreaStatusCallback) => {
    ipcRenderer.removeAllListeners('mark-area-status');
    ipcRenderer.on('mark-area-status', callback);
  },
  beginVideoCapture: async (
    observationId: number,
    projectId: number,
    onDone: () => any
  ) => {
    const perm = await navigator.permissions.query({
      name: 'display-capture' as unknown as PermissionName,
    });
    if (perm.state !== 'granted') {
      throw new Error(
        'Screen recording permission was not granted from browser'
      );
    }

    // cleanup existing ipcRenderer listeners
    ipcRenderer.removeAllListeners('refresh-uploaded-files');
    ipcRenderer.removeAllListeners('stop-video-capture');

    // when main thread tells os to begin capturing, lets open the stream!
    ipcRenderer.once(
      'video-capture',
      async (event, fullWidth: number, fullHeight: number) => {
        // TODO: ensure supported
        const supported = navigator.mediaDevices.getSupportedConstraints();

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false, // DOESNT WORK IF SET TO TRUE :S
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              frameRate: { min: 15, max: 60, ideal: 60 },
              resizeMode: 'none',
              maxFrameRate: 60,
              minFrameRate: 60,
              width: { max: fullWidth },
              height: { max: fullHeight },
            },
          },
        } as any);
        // TODO: do something about multiple tracks!
        // const vTracks = stream.getVideoTracks();
        // const aTracks = stream.getAudioTracks();
        // console.log('VIDEO TRACKS (if more than one, heres a refactor for you! :\')');
        // console.log(vTracks.length);
        // console.log('\nAUDIO TRACKS (if more than one, heres a refactor for you! :\')');
        // console.log(aTracks.length);

        stream.getVideoTracks().forEach(function (track) {
          console.log(
            'video-track',
            JSON.stringify(
              {
                label: track.label,
                trackId: track.id,
                settings: track.getSettings(),
                constraints: track.getConstraints(),
                capabilities: track.getCapabilities(),
              },
              null,
              2
            )
          );

          // TODO: not sure if needed
          track.applyConstraints({
            width: { ideal: fullWidth },
            height: { ideal: fullHeight },
            frameRate: { ideal: 60 },
          });
        });

        // set global recorder and add eventlisteners
        recorder = new MediaRecorder(stream);
        const blobs: Blob[] = [];
        recorder.onerror = (err) => console.error(err);
        recorder.ondataavailable = (ev) => blobs.push(ev.data);
        recorder.onstop = async (_ev) => {
          // create video file blob and send to main thread (without saving file)
          const fullBlob = new Blob(blobs, { type: 'video/webm' });
          const arrBuf = await toArrayBuffer(fullBlob);
          ipcRenderer.once('refresh-uploaded-files', () => onDone());
          ipcRenderer.send('video-capture-done', arrBuf);
        };

        recorder.start();
      }
    );

    // called when mainthread wants renderer to stop capturing
    ipcRenderer.once('stop-video-capture', () => {
      recorder?.stop();
    });

    // send to main thread that we want to start video capture!
    // NOTE: this should reply by emitting the 'video-capture' event above
    ipcRenderer.send('begin-video-capture', projectId, observationId);
  },
});

// TODO: add timeout and size error
function toArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve) => {
    const fileReader = new FileReader();
    fileReader.onload = function () {
      resolve(this.result as ArrayBuffer);
    };
    fileReader.readAsArrayBuffer(blob);
  });
}
