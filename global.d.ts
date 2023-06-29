export interface IElectronAPI {
  areaMarked(rect: { x: number; y: number; width: number; height: number; }): unknown;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}