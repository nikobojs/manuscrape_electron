import { screen, Tray, ipcMain, MenuItem, Menu, globalShortcut } from 'electron';
import path from 'path';
import { quickScreenshot, scrollScreenshot } from './helpers/screenshots';
import { createOverlayWindow, createTrayWindow } from './helpers/browserWindows';

export class ManuScrapeController {
  private app: Electron.App;
  private window: Electron.BrowserWindow;
  private allDisplays: Array<Electron.Display>
  private tray: Tray | undefined;
  private activeDisplayIndex: number;

  constructor(app: Electron.App) {
    this.app = app;
    this.allDisplays = screen.getAllDisplays();
    this.activeDisplayIndex = 0;

    // get initial tray icon
    const image = path.join(__dirname, "../../assets/tray.png");

    // setup tray app
    this.tray = new Tray(image);
    this.tray.setToolTip("ManuScrape");
    this.tray.setIgnoreDoubleClickEvents(true);

    // add open menu event listeners
    this.tray.on("click", () => this.openMenu);
    this.tray.on("right-click", () => this.openMenu);

    // create hidden window
    // NOTE: this is required to avoid the tray app getting garbage collected
    const trayWindow = createTrayWindow();
    this.window = trayWindow

    // setup initial context menu based on current state
    this.refreshContextMenu();

    // setup shortcuts
    this.setupShortcuts();
  }


  openMenu(): void {
    if (this.tray) {
      this.tray.popUpContextMenu();
    } else {
      throw new Error('Unable to open context menu, when tray app is not running');
    }
  }


  chooseScreen(displayIndex: number): void {
    this.activeDisplayIndex = displayIndex;
    this.refreshContextMenu();
  }


  getActiveDisplay(): Electron.Display {
    const activeDisplay = this.allDisplays[this.activeDisplayIndex];
    return activeDisplay;
  }


  createQuickScreenshot(): void {
    const activeDisplay = this.getActiveDisplay();
    ipcMain.once(
      'area-marked',
      (_event, area) => quickScreenshot(
        area,
        activeDisplay,
        this.activeDisplayIndex
      )
    );
    createOverlayWindow(activeDisplay);
  }


  createScrollScreenshot(): void {
    const activeDisplay = this.getActiveDisplay();
    ipcMain.once(
      'area-marked',
      (_event, area) => scrollScreenshot(
        area,
        activeDisplay,
        this.activeDisplayIndex
      )
    );
    createOverlayWindow(activeDisplay);
  }


  private setupShortcuts(): void {
    globalShortcut.register('Alt+Q', () => {
      console.log('Quitting ManuScrape...');
      this.app.exit(0)
    })
    globalShortcut.register('Alt+N', () => this.createQuickScreenshot())
    globalShortcut.register('Alt+S', () => this.createScrollScreenshot())
  }


  private refreshContextMenu(): void {
    if (!this.tray) {
      throw new Error('Cannot refresh contextmenu, when tray app is not running')
    }

    // declare empty menu item array
    const menuItems = [] as MenuItem[];

    // quick screenshot menu item
    const itemQuickScreenshot = new MenuItem({
      label: "Nyt screenshot",
      type: "normal",
      click: () => this.createQuickScreenshot(),
      accelerator: 'Alt+N'
    });

    // scroll screenshot menu item
    const itemScrollScreenshot = new MenuItem({
      label: "Nyt scroll screenshot",
      type: "normal",
      click: () => this.createScrollScreenshot(),
      accelerator: 'Alt+S'
    });

    // create new empty screens submenu
    const screenMenu = new MenuItem({
      label: "Aktiv skærm",
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
        click: () => this.chooseScreen(i),
      })

      // add screen to submenu
      screenMenu.submenu?.insert(i, screenMenuItem)
    }

    // exit context menu item
    const itemExit = new MenuItem({
      label: "Quit",
      role: "quit",
    });

    // add all menu items
    menuItems.push(itemQuickScreenshot);
    menuItems.push(itemScrollScreenshot);
    menuItems.push(screenMenu);
    menuItems.push(itemExit);

    // overwrite tray app context menu with generated one
    const contextMenu = Menu.buildFromTemplate(menuItems);
    this.tray.setContextMenu(contextMenu);
  }
}