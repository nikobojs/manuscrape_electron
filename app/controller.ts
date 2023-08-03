import { Notification, shell, screen, Tray, ipcMain, MenuItem, Menu, globalShortcut, safeStorage, session, dialog, BrowserWindow } from 'electron';
import path from 'path';
import { URL } from 'node:url'
import { quickScreenshot, scrollScreenshot } from './helpers/screenshots';
import { createOverlayWindow, createSignInWindow, createNuxtAppWindow } from './helpers/browserWindows';
import { trayIcon, bugReportIcon, logoutIcon, addIcon, loginIcon, monitorIcon, quitIcon } from './helpers/icons';
import fs from 'node:fs';
import { fetchUser, logout, tryLogin, renewCookie } from './helpers/api';
import * as cookie from 'cookie';


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
  private hostPath: string;
  private activeProjectId: number | undefined;


  constructor(app: Electron.App, trayWindow: BrowserWindow) {
    this.app = app;
    this.allDisplays = screen.getAllDisplays();
    this.activeDisplayIndex = 0;
    this.isMarkingArea = false;
    this.tokenPath = path.join(app.getPath('userData'), 'token.txt.enc');
    this.hostPath = path.join(app.getPath('userData'), 'host.txt.enc');

    // setup tray app
    this.tray = new Tray(trayIcon);
    this.tray.setToolTip("ManuScrape");
    this.tray.setIgnoreDoubleClickEvents(true);

    // add open menu event listeners
    this.tray.on("click", () => this.openMenu());
    this.tray.on("right-click", () => this.openMenu());

    // save hidden tray window to state
    // NOTE: this is required to avoid the tray app getting garbage collected
    this.trayWindow = trayWindow;

    // try signing
    this.initialAuth().finally(() => {
      // update context menu and setup shortcuts
      this.refreshContextMenu();
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


  // function that tries to authorize using files and cookies
  private async initialAuth() {
    const hasAuthCookie = await this.authCookieExists();
    const tokenExists = this.tokenFileExists();
    const hostExists = this.hostFileExists();

    // define initial host and token values to be used for authorization
    let host, token;

    try {
      // if host and token files exists, try authorizing with them
      if (hostExists) {
        this.apiHost = this.readHostFile();
        host = this.apiHost;
      }

      // sign in with token if host and token files exist
      if (tokenExists && hostExists) {
        console.info('signing in with token and host files');
        token = this.readTokenFile();
      // if host file exists and cookie exists, extract token from cookie
      // TODO: fix pattern
      } else if (hasAuthCookie && hostExists) {
        console.info('signing in with cookie and saved host file');
        token = await this.readTokenFromCookie();
      }
    } catch(err: any) {
      // TODO: report errors?
      // TODO: test for specific errors
      console.warn('Ignoring error when authorizing intially:');
      console.warn(err)

      // TODO: report specific errors to user (os notifications?)
      if (/fetch\ failed/i.test(err?.message)) {
        console.error('Unable to connect to host');
      }
    } finally {
      // use retrieved 'host' and 'token' to renew cookie and fetch user
      if (host && token) {
        await this.renewCookieFromToken(host, token).catch(() => {});
        await this.refreshUser(host, token);
      }
    }
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


  // BEGIN file operations and helpers
  private tokenFileExists(): boolean {
    return fs.existsSync(this.tokenPath);
  }
  private hostFileExists(): boolean {
    return fs.existsSync(this.hostPath);
  }
  private readHostFile(): string {
    const encrypted = fs.readFileSync(this.hostPath);
    const host = safeStorage.decryptString(encrypted);
    return host;
  }
  private saveHostFile(host: string) {
    const encryptedHost = safeStorage.encryptString(host);
    fs.writeFileSync(this.hostPath, encryptedHost)
  }
  private saveTokenFile(token: string): void {
    const encryptedToken = safeStorage.encryptString(token);
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
  private deleteHostFile(): void {
    fs.unlinkSync(this.hostPath);
  }
  // END file operations and helpers


  // Some small cookie helpers
  private async readAuthCookies(): Promise<Electron.Cookie[]> {
    const cookies = await session.defaultSession.cookies.get({ name: 'authcookie' })
    return cookies;
  }
  private async authCookieExists(): Promise<boolean> {
    const cookies = await this.readAuthCookies();
    return cookies.length > 0;
  }
  private async removeAuthCookies(): Promise<void> {
    const cookiesExist = await this.authCookieExists();
    if (cookiesExist && this.apiHost) {
      await session.defaultSession.cookies.remove(this.apiHost, 'authcookie');
    }
  }


  // async function that returns token from first auth cookie
  // and throws if none found
  private async readTokenFromCookie(): Promise<string> {
    const cookies = await this.readAuthCookies();
    if (cookies.length > 0) {
      return cookies[0].value;
    } else {
      throw new Error('Cannot read cookie when it is not defined')
    }
  }


  // renew cookie from host and token
  // - calls endpoint that returns a cookie based on a token
  // - sets session cookie and saves it on client machine
  private async renewCookieFromToken(host: string, token: string): Promise<void> {
    const res = await renewCookie(host, token);
    if (res.status !== 200) {
      throw new Error('Server returned status ' + res.status + ' when renewing cookie');
    } else {
      const newCookie = this.parseAuthCookie(host, res);
      session.defaultSession.cookies.set(newCookie);
    }
  }


  // read auth cookie from response object and throw if its bad
  private parseAuthCookie(host: string, res: Response): Electron.CookiesSetDetails {
    const cookieVal = res.headers.get('Set-Cookie');
    if (!cookieVal) {
      throw new Error('The response headers does not include \'Set-Cookie\'');
    }
    const parsed = cookie.parse(cookieVal);
    const hostUrl = new URL(host);
    const newCookie: Electron.CookiesSetDetails = {
      value: parsed.authcookie,
      expirationDate: new Date(parsed.Expires).getTime(),
      path: '/',
      sameSite: 'strict' as "strict" | "unspecified" | "no_restriction" | "lax",
      url: host,
      name: 'authcookie',
      httpOnly: true,
      secure: false, // TODO,
      domain: hostUrl.hostname
    };
    return newCookie;
  }


  // fetch fresh user object and save it to state
  private async refreshUser(host: string, token: string) {

    // try fetch user with token
    try {
      const user = await fetchUser(host, token);
      this.user = user;
      this.loginToken = token;
      this.apiHost = host;
      this.saveHostFile(host);
      this.saveTokenFile(token);
      new Notification({
        title: 'ManuScrape',
        body: 'Signed in with ' + user?.email + '.',
      }).show();
    console.info('refreshed user', { host, email: user?.email });
    } catch(e) {
      console.error(e);
      // TODO: report error
      // ignore expired/bad token
    }
  }


  // reset auth session and update UI accordingly
  private async resetAuth() {
    if (this.apiHost && this.loginToken) {
      await logout(this.apiHost, this.loginToken);
      const cookies = await this.readAuthCookies();
      if (cookies.length > 0) {
        await this.removeAuthCookies();
      }
    }
    this.loginToken = undefined;
    this.user = undefined;
    this.deleteTokenFile();
    await this.refreshContextMenu();
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

    // update cookie so browser window is logged in by default
    // TODO: this might not be needed
    await this.renewCookieFromToken(host, token);

    // try fetch user with token
    // NOTE: this confirms that the token works, and saves credentials in safeStorage
    await this.refreshUser(host, token);

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
      ipcMain.once('ask-for-default-host-value', (event) => {
        event.reply('default-host-value', this?.apiHost || '')
      })
      this.signInWindow = createSignInWindow();
    }
  }


  // opens webapp (hopefully authorized always!)
  // TODO: refactor
  private async openNuxtAppWindow() {
    if (!this.apiHost) {
      throw new Error('Api host not set when opening external browser window')
    }

    createNuxtAppWindow(this.apiHost, async () => {
      const cookies = await this.readAuthCookies();
      if (!this.apiHost) {
        throw new Error('Api host not set when opening external browser window')
      }
      const hostUrl = new URL(this.apiHost);
      const invalidationCookie = cookies.find((cookie) => 
        cookie.domain == hostUrl.hostname &&
        cookie.name === 'authcookie' &&
        cookie.value === ''
      );

      if (invalidationCookie) {
        console.info('sign out using browser window')
        await this.resetAuth();
      } else if (this.isLoggedIn() && this.loginToken) {
        await this.refreshUser(this.apiHost, this.loginToken);
        this.refreshContextMenu();
      }
    });
  }


  // add hardcoded global shortcuts
  // NOTE: should only be called once
  // NOTE: this should always match the MenuItem accelerators
  // TODO: refactor
  private setupShortcuts(): void {
    globalShortcut.register('Alt+Q', () => {
      console.info('caught exit shortcut. will exit now');
      this.app.exit(0)
    })
    globalShortcut.register('Alt+N', () => this.createQuickScreenshot())
    globalShortcut.register('Alt+S', () => this.createScrollScreenshot())
    console.info('set up keyboard shortcuts')
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

  private chooseProject(id: number) {
    this.activeProjectId = id;
    this.refreshContextMenu();
  }


  // refresh the context menu ui based on state of current ManuController instance
  // TODO: refactor function and improve readability
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
    } else if(this.isLoggedIn() && this.user) {
      if (this.user.projects.length == 0) {
        menuItems.push(new MenuItem({
          label: "Create first project",
          type: "normal",
          click: () => this.openNuxtAppWindow(),
          icon: addIcon,
        }));
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
      }

    }


    // add nice seperator (dynamic stuff above seperator, always-there stuff in the bottom)
    menuItems.push(new MenuItem({
      type: 'separator',      
    }));

    if (this.isLoggedIn() && this.user) {

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

      // TODO: refactor function and improve readability
      if (this.user.projects.length > 0) {
        // add projects to menuItems
        const projectMenu = new MenuItem({
          label: "Choose project",
          submenu: [],
          type: 'submenu',
        })

        if (this.user.projects.length > 0) {
          for (let i = 0; i < this.user.projects.length; i++) {
            const project = this.user.projects[i];
            projectMenu.submenu?.insert(i, new MenuItem({
              id: project.id.toString(),
              label: project.name,
              type: 'radio',
              checked: this.activeProjectId == project.id,
              click: () => this.chooseProject(project.id),
            }));
          }
        }

        if (this.activeProjectId == undefined) {
          this.chooseProject(this.user.projects[0].id);
          const chosenMenuItem = projectMenu.submenu?.items.find((item) =>
            item.id === this.activeProjectId?.toString()
          )
          if (chosenMenuItem) {
            chosenMenuItem.checked = true;
          }
        }
        menuItems.push(projectMenu);
      }

      // add menu to menuItems
      menuItems.push(screenMenu);

      // add nice seperator (dynamic stuff above seperator, always-there stuff in the bottom)
      menuItems.push(new MenuItem({
        type: 'separator',      
      }));

      menuItems.push(new MenuItem({
        label: "Log out",
        type: "normal",
        click: () => this.logOut(),
        icon: logoutIcon,
      }));

      menuItems.push(new MenuItem({
        label: "Open web app",
        type: "normal",
        click: () => this.openNuxtAppWindow(),
      }));

      menuItems.push(new MenuItem({
        label: "Report issue",
        type: "normal",
        click: () => shell.openExternal('https://github.com/nikobojs/manuscrape_electron/issues'),
        icon: bugReportIcon,
      }));

    }

    // exit context menu item
    const itemExit = new MenuItem({
      label: "Quit",
      enabled: !this.isMarkingArea,
      role: "quit",
      icon: quitIcon,
    });

    // add all menu items
    menuItems.push(itemExit);

    // overwrite tray app context menu with generated one
    const contextMenu = Menu.buildFromTemplate(menuItems);
    this.tray.setContextMenu(contextMenu);
    console.info('context menu refreshed', { isLoggedIn: this.isLoggedIn() })
  }
}