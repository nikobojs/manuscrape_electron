import { screen, Tray, ipcMain, MenuItem, Menu, globalShortcut, nativeImage } from 'electron';
import path from 'path';
import { quickScreenshot, scrollScreenshot } from './helpers/screenshots';
import { createOverlayWindow, createTrayWindow, createSignInWindow } from './helpers/browserWindows';
import { trayIcon, createIcon } from './helpers/icons';


export class ManuScrapeController {
  private app: Electron.App;
  private trayWindow: Electron.BrowserWindow;
  private signInWindow: Electron.BrowserWindow | undefined;
  private overlayWindow: Electron.BrowserWindow | undefined;
  private allDisplays: Array<Electron.Display>
  private tray: Tray | undefined;
  private activeDisplayIndex: number;
  private isMarkingArea: boolean;
  private loginToken: string | undefined;

  constructor(app: Electron.App) {
    this.app = app;
    this.allDisplays = screen.getAllDisplays();
    this.activeDisplayIndex = 0;
    this.isMarkingArea = false;

    // setup tray app
    this.tray = new Tray(trayIcon);
    this.tray.setToolTip("ManuScrape");
    this.tray.setIgnoreDoubleClickEvents(true);

    // add open menu event listeners
    this.tray.on("click", () => this.openMenu);
    this.tray.on("right-click", () => this.openMenu);

    // create hidden window
    // NOTE: this is required to avoid the tray app getting garbage collected
    const trayWindow = createTrayWindow();
    this.trayWindow = trayWindow;

    // setup initial context menu based on current state
    this.refreshContextMenu();

    // setup shortcuts
    this.setupShortcuts();
  }


  // open context menu
  public openMenu(): void {
    if (this.tray) {
      this.tray.popUpContextMenu();
    } else {
      throw new Error('Unable to open context menu, when tray app is not running');
    }
  }


  // choose display where the overlay will appear
  public useDisplay(displayIndex: number): void {
    this.activeDisplayIndex = displayIndex;
    this.refreshContextMenu();
  }


  // helper function that returns the active display
  public getActiveDisplay(): Electron.Display {
    const activeDisplay = this.allDisplays[this.activeDisplayIndex];
    return activeDisplay;
  }


  // create new quick screenshot
  public createQuickScreenshot(): void {
    const activeDisplay = this.getActiveDisplay();
    ipcMain.once(
      'area-marked', // TODO: use enum
      async (_event, area) => {
        this.onMarkAreaDone();
        await quickScreenshot(
          area,
          activeDisplay,
          this.activeDisplayIndex
        )
      }
    );

    this.openMarkAreaOverlay();
  }


  // create new scroll screenshot
  public createScrollScreenshot(): void {
    ipcMain.once(
      'area-marked', // TODO: use enum
      async (_event, area) => {
        this.onMarkAreaDone();
        await scrollScreenshot(
          area,
          this.getActiveDisplay(),
          this.activeDisplayIndex
        )
      }
    );

    this.openMarkAreaOverlay();
  }


  // try to reset state by removing listeners and closing overlay
  public cancelOverlay() {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      ipcMain.removeAllListeners();
      this.onMarkAreaDone();
      globalShortcut.unregister('Alt+C')
      this.overlayWindow.destroy();
    }
  }


  // function that will always be called after an area has been marked
  private onMarkAreaDone() {
    this.isMarkingArea = false;
    this.refreshContextMenu();
  }


  // open markArea overlay. IPC listeners should have be added beforehand
  private openMarkAreaOverlay() {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      throw new Error('Overlay window is already active');
    }
    this.isMarkingArea = true;
    this.overlayWindow = createOverlayWindow(this.getActiveDisplay());
    this.refreshContextMenu();
    globalShortcut.register('Alt+C', () => this.cancelOverlay());
  }

  // open markArea overlay. IPC listeners should have be added beforehand
  private openSignInWindow() {
    if (this.signInWindow && !this.signInWindow.isDestroyed()) {
      this.signInWindow.focus();
    } else {
      // create new sign in window
      // TODO: pass sensitive token data
      ipcMain.once(
        'sign-in', // TODO: use enum
        async (_event, data) => {
          console.log('USER TRY SIGN IN!', data)
          // TODO: log in and send response status back to client, which can close itself
        }
      );
      this.signInWindow = createSignInWindow();
    }
  }


  // add hardcoded global shortcuts
  // NOTE: should only be called once
  // NOTE: this should always match the MenuItem accelerators
  // TODO: refactor
  private setupShortcuts(): void {
    globalShortcut.register('Alt+Q', () => {
      console.log('Quitting ManuScrape...');
      this.app.exit(0)
    })
    globalShortcut.register('Alt+N', () => this.createQuickScreenshot())
    globalShortcut.register('Alt+S', () => this.createScrollScreenshot())
  }


  // is logged in helper
  private isLoggedIn(): boolean {
    return !!this.loginToken;
  }


  // refresh the context menu ui based on state of current ManuController instance
  private refreshContextMenu(): void {
    if (!this.tray) {
      throw new Error('Cannot refresh contextmenu, when tray app is not running')
    }

    // declare empty menu item array
    const menuItems = [] as MenuItem[];
    if (!this.isLoggedIn()) {
      menuItems.push(new MenuItem({
        type: 'normal',
        label: 'Sign in to ManuScrape',
        click: () => {
          this.openSignInWindow();
        }
      }))
    } else if (this.isMarkingArea) {
      menuItems.push(new MenuItem({
        role: 'help',
        label: 'Overlay is currently open',
        enabled: false,
      }))
      menuItems.push(new MenuItem({
        type: 'normal',
        label: 'Cancel action',
        click: () => {
          this.cancelOverlay();
        },
        accelerator: 'Alt+C',
      }))
    } else {
      menuItems.push(new MenuItem({
        label: "Take screenshot",
        type: "normal",
        click: () => this.createQuickScreenshot(),
        accelerator: 'Alt+N',
        icon: createIcon,
      }));

      menuItems.push(new MenuItem({
        label: "Take scrollshot",
        type: "normal",
        click: () => this.createScrollScreenshot(),
        accelerator: 'Alt+S',
        icon: createIcon,
      }));
    }

    // add nice seperator (dynamic stuff above seperator, always-there stuff in the bottom)
    menuItems.push(new MenuItem({
      type: 'separator',      
    }));

    // create new empty screens submenu
    const screenMenu = new MenuItem({
      label: "Choose monitor",
      sublabel: this.getActiveDisplay().label,
      submenu: [],
      type: 'submenu',
      accelerator: 'Alt+Q'
    });

    // update screens available
    this.allDisplays = screen.getAllDisplays();

    // add all screens to submenu
    for (let i = 0; i < this.allDisplays.length; i++) {
      const display = this.allDisplays[i];

      // create screen submenu item
      const screenMenuItem = new MenuItem({
        label: display.label,
        id: display.id.toString(),
        type: 'radio',
        checked: this.activeDisplayIndex == i,
        enabled: !this.isMarkingArea,
        click: () => this.useDisplay(i),
      })

      // add screen to submenu
      screenMenu.submenu?.insert(i, screenMenuItem)
    }

    // exit context menu item
    const itemExit = new MenuItem({
      label: "Quit",
      enabled: !this.isMarkingArea,
      role: "quit",
    });

    // add all menu items
    menuItems.push(screenMenu);
    menuItems.push(itemExit);

    // overwrite tray app context menu with generated one
    const contextMenu = Menu.buildFromTemplate(menuItems);
    this.tray.setContextMenu(contextMenu);
  }
}