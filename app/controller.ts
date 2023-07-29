import { screen, Tray, ipcMain, MenuItem, Menu, globalShortcut, safeStorage, dialog, BrowserWindow } from 'electron';
import path from 'path';
import { URL } from 'node:url'
import { quickScreenshot, scrollScreenshot } from './helpers/screenshots';
import { createOverlayWindow, createSignInWindow } from './helpers/browserWindows';
import { trayIcon, logoutIcon, addIcon, loginIcon, monitorIcon, quitIcon } from './helpers/icons';
import fs from 'node:fs';
import { fetchUser, logout, tryLogin } from './helpers/api';
import { ensureEncryptionAvail } from './helpers/utils';


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
  private user: IUser | undefined;
  private apiHost: string | undefined;
  private tokenPath: string;

  constructor(app: Electron.App, trayWindow: BrowserWindow) {
    this.app = app;
    this.allDisplays = screen.getAllDisplays();
    this.activeDisplayIndex = 0;
    this.isMarkingArea = false;
    this.tokenPath = path.join(app.getPath('userData'), 'token.txt.enc');

    // setup tray app
    this.tray = new Tray(trayIcon);
    this.tray.setToolTip("ManuScrape");
    this.tray.setIgnoreDoubleClickEvents(true);

    // add open menu event listeners
    this.tray.on("click", () => this.openMenu);
    this.tray.on("right-click", () => this.openMenu);

    // save hidden tray window to state
    // NOTE: this is required to avoid the tray app getting garbage collected
    this.trayWindow = trayWindow;

    // log in with token file if it exists
    this.loginWithTokenFile().then(() => {
      // setup initial context menu based on current state
      this.refreshContextMenu();

      // setup shortcuts
      this.setupShortcuts();
    });
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


  // function that tries to log in with the token file
  private async loginWithTokenFile(): Promise<void> {
    // read the file contents into variable `content`
    let content;
    try {
      content = this.readTokenFile();
    } catch(e: any) {
      if (e?.name !== 'Error' || !e?.message?.startsWith?.('ENOENT')) {
        // if error is not file-not-found, throw up
        throw e;
      } else {
        // file not found. Return early
        return;
      }
    }


    if (!content || !content.includes('|||') || content.split('|||').length !== 2) {
      // ignore if token is invalid.
      // user will need to login which will overwrite the token
      return;
    }

    const splitted = content.split('|||');

    const host = splitted[0];
    const token = splitted[1];

    // try fetch user with token
    try {
      const user = await fetchUser(host, token);
      this.user = user;
      this.loginToken = token;
      this.apiHost = host;
    } catch(e) {
      console.error(e);
      // TODO: report error
      // ignore expired/bad token
    }
  }

  private saveTokenFile(token: string, host: string): void {
    const encryptedToken = safeStorage.encryptString(host + '|||' + token);
    fs.writeFileSync(this.tokenPath, encryptedToken)
  }

  private readTokenFile(): string {
    const encrypted = fs.readFileSync(this.tokenPath);
    const token = safeStorage.decryptString(encrypted);
    return token;
  }

  private deleteTokenFile(): void {
    fs.unlinkSync(this.tokenPath);
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

  private async loginHandler(
    event: Electron.IpcMainEvent,
    {email, password, host}: ISignInBody,
  ): Promise<void> {
    // wait a little bit, for UX purpose
    await new Promise((ok) => setTimeout(ok, 200));

    // if no scheme is set, default to https
    const hasProtocol = /^.+\:\/\//.test(host);
    if (!hasProtocol) {
      host = 'https://' + host;
    }

    // try parse host string
    try {
      const parsedUrl = new URL(host);

      // only allow http and https
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return event.reply(
          'sign-in-error',
          'The host input field must begin with http:// or https://'
        ) // TODO: use enum
      }
    } catch(_e) {
      return event.reply(
        'sign-in-error',
        'Invalid host input value'
      ) // TODO: use enum
    }


    // call api and get login token
    let token: string | undefined;
    try {
      const json = await tryLogin(host, email, password);
      token = json.token;
    } catch(e: any) {
      // there was some kind of error. lets parse it
      let msg = e?.message || 'Unknown error'

      // covers basic errors for bad hosts
      // TODO: improve error handling for more error cases
      if (e?.cause) {
        if (['EAI_AGAIN', 'ENOTFOUND'].includes(e.cause?.code)) {
          msg = 'The host is invalid or not available'
        } else if (e.cause?.code == 'ERR_SSL_WRONG_VERSION_NUMBER') {
          msg = 'This kind of URL is invalid. Please specify the protocol.'
        }
      }

      // return `msg` to client, so error can be rendered
      return event.reply(
        'sign-in-error',
        msg,
      ) // TODO: use enum
    }

    // if we still dont have a token, we have to blame the api
    if (!token) {
      return event.reply(
        'sign-in-error',
        'The server did not return the token.'
      ) // TODO: use enum
    }

    // try fetch user with token
    // NOTE: this confirms that the token works
    const user = await fetchUser(host, token);

    // save/overwrite an encrypted text file with the token
    this.saveTokenFile(token, host);

    // update instance state to reflect login
    this.loginToken = token;
    this.apiHost = host;
    this.user = user;

    // tell client login was successful
    event.reply('sign-in-ok'); // TODO: use enum

    // remove all sign-in listeners, so this wont be executed multiple times
    ipcMain.removeAllListeners('sign-in');

    // refresh context menu, now that we are logged in
    this.refreshContextMenu();
  }

  // open markArea overlay. IPC listeners should have be added beforehand
  private openSignInWindow() {
    if (this.signInWindow && !this.signInWindow.isDestroyed()) {
      this.signInWindow.focus();
    } else {
      // create new sign in window
      // TODO: pass sensitive token data
      ipcMain.on(
        'sign-in', // TODO: use enum
        (event, body) => this.loginHandler(event, body),
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


  // log out function
  private logOut() {
    dialog.showMessageBox(this.trayWindow, {
      buttons: ['No', 'Yes'],
      message: 'Are you sure you want to log out?',
    }).then(async (res) => {
      if (res.response == 1) {
        await this.resetAuth();
      }
    });
  }


  private async resetAuth() {
    if (this.apiHost && this.loginToken) {
      await logout(this.apiHost, this.loginToken);
    }
    this.apiHost = undefined;
    this.loginToken = undefined;
    this.user = undefined;
    this.deleteTokenFile();
    await this.refreshContextMenu();
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
        label: 'Sign in',
        click: () => {
          this.openSignInWindow();
        },
        icon: loginIcon,
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
        icon: addIcon,
      }));

      menuItems.push(new MenuItem({
        label: "Take scrollshot",
        type: "normal",
        click: () => this.createScrollScreenshot(),
        accelerator: 'Alt+S',
        icon: addIcon,
      }));

      menuItems.push(new MenuItem({
        label: "Log out",
        type: "normal",
        click: () => this.logOut(),
        icon: logoutIcon,
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
      icon: monitorIcon,
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
      icon: quitIcon,
    });

    // add all menu items
    menuItems.push(screenMenu);
    menuItems.push(itemExit);

    // overwrite tray app context menu with generated one
    const contextMenu = Menu.buildFromTemplate(menuItems);
    this.tray.setContextMenu(contextMenu);
  }
}