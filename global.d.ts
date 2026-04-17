import { IpcRendererEvent } from "electron";

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
      project: IGetProjectResponse;
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

  type DynamicProjectFieldResponse = {
    id: number;
    label: string;
    createdAt: string;
    field0Id: number;
    field1Id: number;
    projectId: number;
    operator: string;
  };

  type TagResponse = {
    createdById: number;
    id: number;
    name: string;
    projectId: number;
  };

  type SmallProjectFieldResponse = {
    required: boolean;
    type:
      | "DATE"
      | "STRING"
      | "INT"
      | "FLOAT"
      | "DATETIME"
      | "BOOLEAN"
      | "CHOICE"
      | "MULTIPLE_CHOICE_ADD"
      | "AUTOCOMPLETE"
      | "AUTOCOMPLETE_ADD"
      | "TEXTAREA"
      | "IMAGE_SINGLE"
      | "IMAGE_MULTIPLE";
    label: string;
    index: number;
    choices: string | null;
    id: number;
    projectId: number;
    createdAt: Date;
  };

  interface IGetProjectResponse {
    id: number;
    name: string;
    storageLimit: number;
    createdAt: string | Date;
    authorCanDelockObservations: boolean;
    ownerCanDelockObservations: boolean;
    contributorsCanReadAllObservations: boolean;
    contributorsCanExport: boolean;
    fields: SmallProjectFieldResponse[];
    dynamicFields: DynamicProjectFieldResponse[];
    tags: TagResponse[];
    observationCount: number;
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
  type VersionCallback = (version: string) => void;
  type DeprecatedClientErrorCallback = () => void;
  type ImageUploadedCallback = (
    event: IpcRendererEvent,
    ...args: any[]
  ) => void;
  type MarkAreaStatusCallback = (
    event: IpcRendererEvent,
    status: { statusText: string; statusDescription: string },
  ) => void;

  type SquirrelEvent = "install" | "uninstall" | "firstrun";
}
