import { app, Notification, screen, Tray, ipcMain, Menu, globalShortcut, dialog, BrowserWindow, type IpcMainEvent } from 'electron';
import path from 'path';
import { URL } from 'node:url'
import { quickScreenshot, scrollScreenshot } from './helpers/screenshots';
import { createOverlayWindow, createSignInWindow, createAddProjectWindow, createAddObservationWindow } from './helpers/browserWindows';
import { trayIcon, successIcon, warningIcon } from './helpers/icons';
import { fetchUser, logout, tryLogin, addObservationDraft } from './helpers/api';
import { yesOrNo } from './helpers/utils';
import { authCookieExists, getInvalidationCookie, readAuthCookies, readTokenFromCookie, removeAuthCookies, renewCookieFromToken } from './helpers/cookies';
import { generateContextMenu } from './helpers/contextMenu';
import { fileExists, readFile, saveFile, deleteFile, } from './helpers/safeStorage';


export class ManuScrapeController {
  public isMarkingArea: boolean;
  public allDisplays: Array<Electron.Display>
  public activeProjectId: number | undefined;
  public activeDisplayIndex: number;

  private app: Electron.App;
  private trayWindow: Electron.BrowserWindow | undefined;
  private signInWindow: Electron.BrowserWindow | undefined;
  private nuxtWindow: Electron.BrowserWindow | undefined;
  private overlayWindow: Electron.BrowserWindow | undefined;
  private onAreaMarkedListener: ((event: IpcMainEvent, ...args: any[]) => Promise<void>) | undefined;
  private tray: Tray | undefined;
  private loginToken: string | undefined;
  private apiHost: string | undefined;
  private tokenPath: string;
  private hostPath: string;
  private user: IUser | undefined;
  private contextMenu: Menu | undefined;

  constructor(trayWindow: BrowserWindow) {
    this.app = app;
    this.allDisplays = screen.getAllDisplays();
    this.activeDisplayIndex = 0;
    this.isMarkingArea = false;
    this.tokenPath = path.join(app.getPath('userData'), 'token.txt.enc');
    this.hostPath = path.join(app.getPath('userData'), 'host.txt.enc');

    trayWindow.on('ready-to-show', () => {
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

      // try sign in and populate context menu
      this.init();
    });
  }


  // open context menu
  public openMenu(): void {
    if (this.tray) {
      if (this.contextMenu) {
        this.tray.setContextMenu(this.contextMenu)
      } else {
        throw new Error('Tray menu cannot open without menu items')
      }
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

  //  //logged in helper
  public isLoggedIn(): boolean {
    return !!this.loginToken;
  }


  // log out function
  public async logOut(): Promise<void> {
    if (!this.trayWindow) {
      throw new Error('Tray window is not defined');
    }

    const yes = yesOrNo('Are you sure you want to log out?');
    if (yes) {
      return this.resetAuth();
    }
  }

  // update activeProjectId and refresh menu
  public chooseProject(id: number) {
    this.activeProjectId = id;
    this.refreshContextMenu();
  }

  // create new quick screenshot
  public async createQuickScreenshot(): Promise<void> {
    // ensure there is not already an observation being made
    const confirmed = await this.confirmCloseNuxtWindowIfAny()
    if (!confirmed) {
      return;
    }

    // define callback action when area has been marked
    const onMarkedArea = async (event: IpcMainEvent, area: any) => {

      event.sender.close();
      const activeDisplay = this.getActiveDisplay();
      this.onMarkAreaDone();
      await quickScreenshot(
        area,
        activeDisplay,
        this.activeDisplayIndex
      )

      // make typescript linters happy
      // NOTE: none of these errors should ever happen
      // TODO: report errors
      if (!this.activeProjectId) {
        console.error('no project id')
        throw new Error('activeProjectId is not set')
      } else if (!this.apiHost) {
        console.error('no api host')
        throw new Error('apiHost is not set')
      } else if (!this.loginToken) {
        console.error('no login token')
        throw new Error('loginToken not attached to controller instance');
      }

      // add draft and use returned id to create observation
      const res = await addObservationDraft(
        this.apiHost,
        this.loginToken,
        this.activeProjectId
      );
      const observationDraftId = res.id;

      // create add observation window using draft id
      const win = createAddObservationWindow(
        this.apiHost,
        this.activeProjectId,
        observationDraftId,
        () => this.onExternalWindowClose()
      )

      // add observation-created listener
      ipcMain.once('observation-created', (res) => {
        if (this.nuxtWindow) {
          this.nuxtWindow.close();
        }
        new Notification({
          title: 'ManuScrape',
          body: 'Observation created successfully',
          icon: successIcon,
        }).show();
        this.refreshContextMenu();
      });

      // safe window in instance state
      this.nuxtWindow = win;
    };

    // add listener to state so it can be removed later
    // NOTE: removeEventListener requires a reference to the function
    this.setOnAreaMarkedListener(onMarkedArea);

    // now once listeners are attached, open mark area overlay
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

    // TODO: needs development!
    // TODO: open create observation window like createQuickScreenshot()
    // TODO: consider generalizing some logic from createQuickScreenshot()

    new Notification({
      title: 'ManuScrape',
      body: 'Scrollshots are not supported yet!',
      icon: warningIcon,
    }).show();

    this.openMarkAreaOverlay();
  }


  // ensure not more than one app window
  private async confirmCloseNuxtWindowIfAny(): Promise<boolean> {
    if (this.nuxtWindow && !this.nuxtWindow.isDestroyed()) {
      this.nuxtWindow.focus();
      const yes = yesOrNo('Are you sure you want to close the existing window?');
      if (yes) {
        this.cancelNuxtWindow()
        await new Promise((r) => setTimeout(r, 200));
      }
      return yes;
    } else {
      return true;
    }
  }


  // function that tries to authorize using files and cookies
  private async init() {
    const hasAuthCookie = await authCookieExists();
    const tokenExists = fileExists(this.tokenPath);
    const hostExists = fileExists(this.hostPath);

    // define initial host and token values to be used for authorization
    let host, token;

    try {
      // if host and token files exists, try authorizing with them
      if (hostExists) {
        this.apiHost = readFile(this.hostPath);
        host = this.apiHost;
      }

      // sign in with token if host and token files exist
      if (tokenExists && hostExists) {
        console.info('signing in with token and host files');
        token = readFile(this.tokenPath);
      // if host file exists and cookie exists, extract token from cookie
      // TODO: fix pattern
      } else if (hasAuthCookie && hostExists) {
        console.info('signing in with cookie and saved host file');
        token = await readTokenFromCookie();
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
      // TODO: weird bug requries refreshContext to be called twice
      // context popup wont show unless refreshContextMenu is called twice
      this.refreshContextMenu();
      this.setupShortcuts();

      // use retrieved 'host' and 'token' to renew cookie and fetch user
      if (host && token) {
        await renewCookieFromToken(host, token).catch(() => {});
        await this.refreshUser(host, token);
        this.refreshContextMenu();
      }
    }
  }


  // try to reset state by removing listeners and closing overlay
  public cancelOverlay() {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      ipcMain.removeAllListeners('area-marked');
      globalShortcut.unregister('Alt+C')
      this.onMarkAreaDone();
      this.overlayWindow.destroy();
    }
  }


  // try to reset state by removing listeners and closing overlay
  public cancelNuxtWindow() {
    if (this.nuxtWindow && !this.nuxtWindow.isDestroyed()) {
      ipcMain.removeAllListeners('area-marked');
      ipcMain.removeAllListeners('observation-created');
      ipcMain.removeAllListeners('project-created');
      globalShortcut.unregister('Alt+C')
      this.onMarkAreaDone();
      this.nuxtWindow.close();
    }
  }


  // function that will always be called after an area has been marked
  private onMarkAreaDone() {
    this.isMarkingArea = false;
    this.refreshContextMenu();
  }




  // fetch fresh user object and save it to state
  private async refreshUser(host: string, token: string) {
    // whether same credentials are already defined in instance properties    
    let freshLogin = host !== this.apiHost || token !== this.loginToken;

    // try fetch user with token
    try {
      // always refresh user and save to instance
      const user = await fetchUser(host, token);
      this.user = user;

      // if token or host is new, save credentials and notify
      if (freshLogin) {
        this.loginToken = token;
        this.apiHost = host;
        saveFile(host, this.hostPath);
        saveFile(token, this.tokenPath);
        new Notification({
          title: 'ManuScrape',
          body: 'Signed in with ' + user?.email + '.',
          icon: successIcon,
        }).show();
      }
    console.info('refreshed user', { host, email: user?.email });
    } catch(e) {
      console.error(e);
      // TODO: report error
      // ignore expired/bad token
    }
  }


  // reset auth session and update UI accordingly
  private async resetAuth() {
    this.loginToken = undefined;
    this.user = undefined;
    this.refreshContextMenu();

    new Notification({
      title: 'ManuScrape',
      body: 'Signed out successfully.',
      icon: successIcon,
    }).show();

    if (this.apiHost && this.loginToken) {
      await logout(this.apiHost, this.loginToken);
      const cookies = await readAuthCookies();
      if (cookies.length > 0) {
        await removeAuthCookies(this.apiHost);
      }
    }
    deleteFile(this.tokenPath);
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
    await renewCookieFromToken(host, token);

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
  public openSignInWindow() {
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
  public async openCreateProjectWindow(): Promise<void> {
    if (!this.apiHost) {
      throw new Error('Api host not set when opening external browser window')
    }

    if (this.nuxtWindow) {
      this.nuxtWindow.focus();
      return;
    }

    ipcMain.once('project-created', (res) => {
      if (this.nuxtWindow) {
        this.nuxtWindow.close();
        new Notification({
          title: 'ManuScrape',
          body: 'Project created successfully',
        }).show();
        this.refreshContextMenu();
      }
    });

    const win = createAddProjectWindow(this.apiHost, () => this.onExternalWindowClose());
    this.nuxtWindow = win;
  }


  // add hardcoded global shortcuts
  // NOTE: should only be called once
  // NOTE: this should always match the MenuItem accelerators
  // TODO: refactor (to refreshShortcuts?)
  private setupShortcuts(): void {
    globalShortcut.register('Alt+Q', () => {
      console.info('caught exit shortcut. will exit now');
      this.app.exit(0)
    })
    globalShortcut.register('Alt+N', () => this.createQuickScreenshot())
    globalShortcut.register('Alt+S', () => this.createScrollScreenshot())
    console.info('set up keyboard shortcuts')
  }


  // overwrites area-marked listener if it is already defined
  private setOnAreaMarkedListener(
    listener: (event: IpcMainEvent, ...args: any[]) => Promise<void>,
  ) {
    if (this.onAreaMarkedListener) {
      ipcMain.removeListener('area-marked', this.onAreaMarkedListener);
    }

    this.onAreaMarkedListener = listener;
    ipcMain.addListener('area-marked', listener)
  }


  // ensure auth state and contextmenu is ok and synced when nuxt window closes
  private async onExternalWindowClose() {
    if (!this.apiHost) {
      throw new Error('Api host not set when opening external browser window')
    }
    const invalidationCookie = await getInvalidationCookie(this.apiHost)

    if (invalidationCookie) {
      console.info('caught signed out in browser window')
      await this.resetAuth();
    } else if (this.isLoggedIn() && this.loginToken) {
      await this.refreshUser(this.apiHost, this.loginToken);
      this.refreshContextMenu();
    }
  }


  // refresh the context menu ui based on state of current ManuController instance
  private refreshContextMenu(): void {
    if (!this.tray) {
      throw new Error('Cannot refresh contextmenu, when tray app is not running')
    }

    const d = new Date();
    this.contextMenu = generateContextMenu(this, this.user);
    this.tray.setContextMenu(this.contextMenu);
    const dd = new Date();
    const diff = dd.getTime() - d.getTime();
    console.info('regenerating menu took', diff, 'ms.')
    console.info('context menu refreshed', { isLoggedIn: this.isLoggedIn(), items: this.contextMenu.items.length })
  }
}