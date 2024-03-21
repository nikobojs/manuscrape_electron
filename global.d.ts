import { IpcRendererEvent } from 'electron';

export interface IElectronAPI {
  areaMarked(rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): unknown;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }

  interface IScreenshot {
    image: Electron.NativeImage;
    size: Electron.Size;
    sizeKb: number;
    buffer: Buffer;
    source: Electron.DesktopCapturerSource;
  }

  interface ISignInBody {
    email: string;
    password: string;
    host: string;
  }

  interface ISignUpBody {
    email: string;
    password: string;
    host: string;
  }

  interface ScrollshotSettings {
    rowsPrCrop: number;
    colsPrCrop: number;
    denoisingFactor: number;
    leftCropFrom: number;
    leftCropTo: number;
    rightCropFrom: number;
    rightCropTo: number;
    matchScoreThreshold: number;
  }

  interface ISettings {
    scrollshot: ScrollshotSettings;
  }

  interface IUser {
    id: number;
    email: string;
    createdAt: string;
    projectAccess: {
      role: string;
      project: {
        id: number;
        createdAt: string;
        name: string;
      };
    }[];
  }

  interface ITokenResponse {
    token: string;
  }

  interface ISuccessResponse {
    success: true;
  }

  interface IObservationCreatedResponse {
    id: number;
  }

  interface Square {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  type SignInCallback = (event: IpcRendererEvent, ...args: any[]) => void;
  type SignUpCallback = (event: IpcRendererEvent, ...args: any[]) => void;
  type UpdateSettingsCallback = (
    event: IpcRendererEvent,
    ...args: any[]
  ) => void;
  type HostValueCallback = (event: IpcRendererEvent, ...args: any[]) => void;
  type ImageUploadedCallback = (
    event: IpcRendererEvent,
    ...args: any[]
  ) => void;
  type MarkAreaStatusCallback = (
    event: IpcRendererEvent,
    status: { statusText: string; statusDescription: string }
  ) => void;
}
