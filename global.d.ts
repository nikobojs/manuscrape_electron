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

  interface IUser {
    id: number;
    email: string;
    createdAt: string;
    projects: Array<any>;
  }

  interface ILoginOKResponse {
    token: string;
  }

  type SignInCallback = (event: IpcRendererEvent, ...args: any[]) => void;
}