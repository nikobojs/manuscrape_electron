import { IpcRendererEvent } from "electron";

export interface IElectronAPI {
  areaMarked(rect: { x: number; y: number; width: number; height: number; }): unknown;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
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

  interface IUser {
    id: number;
    email: string;
    createdAt: string;
    projects: Array<any>;
  }

  interface ITokenResponse {
    token: string;
  }

  interface ISuccessResponse {
    success: true,
  }

  interface IDraftCreatedResponse {
    id: number
  }

  type SignInCallback = (event: IpcRendererEvent, ...args: any[]) => void;
  type SignUpCallback = (event: IpcRendererEvent, ...args: any[]) => void;
  type HostValueCallback = (event: IpcRendererEvent, ...args: any[]) => void;
}