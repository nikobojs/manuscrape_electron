import { app, Notification, screen, Tray, ipcMain, Menu, globalShortcut, BrowserWindow, type IpcMainEvent, ipcRenderer } from 'electron';
import path from 'path';
import { quickScreenshot, scrollScreenshot } from './helpers/screenshots';
import { createOverlayWindow, createAuthorizationWindow, createAddProjectWindow, createAddObservationWindow } from './helpers/browserWindows';
import { trayIcon, successIcon, errorIcon } from './helpers/icons';
import { fetchUser, logout, signIn, addObservation, signUp, parseHostUrl, uploadObservationImage } from './helpers/api';
import { yesOrNo } from './helpers/utils';
import { authCookieExists, getInvalidationCookie, readTokenFromCookie, removeAuthCookies, renewCookieFromToken } from './helpers/cookies';
import { generateContextMenu } from './helpers/contextMenu';
import { fileExists, readFile, saveFile, deleteFile, } from './helpers/safeStorage';


export class ManuScrapeController {
  public isMarkingArea: boolean;
  public allDisplays: Array<Electron.Display>
  public activeProjectId: number | undefined;
  public activeDisplayIndex: number;

  private app: Electron.App;
  private trayWindow: Electron.BrowserWindow | undefined;
  private authWindow: Electron.BrowserWindow | undefined;
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
  private useEncryption: boolean;
  private cancelOperation: boolean;

  constructor(trayWindow: BrowserWindow, useEncryption: boolean) {
    this.app = app;
    this.allDisplays = screen.getAllDisplays();
    this.activeDisplayIndex = 0;
    this.isMarkingArea = false;
    this.cancelOperation = false;
    this.tokenPath = path.join(app.getPath('userData'), 'token.txt.enc');
    this.hostPath = path.join(app.getPath('userData'), 'host.txt.enc');
    this.useEncryption = useEncryption;

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

    // generate callback function that utilizes quickScreenshot
    this.useOnMarkedAreaCallback(quickScreenshot)

    // now once listeners are attached, open mark area overlay
    this.openMarkAreaOverlay();
  }


  // create new scroll screenshot
  public async createScrollScreenshot(): Promise<void> {
    // ensure there is not already an observation being made
    const confirmed = await this.confirmCloseNuxtWindowIfAny()
    if (!confirmed) {
      return;
    }

    // generate callback function that utilizes scrollScreenshot
    this.useOnMarkedAreaCallback(
      scrollScreenshot,
      'Recording scrollshot...',
      'Cancel: Alt+C   Save: Alt+S',
    )

    // now once listeners are attached, open mark area overlay
    this.openMarkAreaOverlay();
  }


  private uploadObservationImage(
    observationId: number,
    filePath: string,
    projectId: number | undefined = this.activeProjectId,
  ) {
    // TODO: make sure errors are handled in caller function
    if (!this.apiHost) throw new Error('Api host is not defined');
    if (!this.loginToken) throw new Error('You are not logged in');
    if (!projectId) throw new Error('Project id could not be found');

    return uploadObservationImage(
      this.apiHost,
      this.loginToken,
      observationId,
      projectId,
      filePath,
    );
  }


  private useOnMarkedAreaCallback(
    callback: (
      area: any,
      activeDisplay: Electron.Display,
      activeDisplayIndex: number,
      isCancelled: () => boolean,
    ) => Promise<string>,
    statusText?: string,
    statusDescription?: string,
  ): void {
    const handler = async (event: IpcMainEvent, area: any) => {
      if (typeof this.apiHost !== 'string') throw new Error('Something went terribly wrong')
      if (typeof this.loginToken !== 'string') throw new Error('Something went terribly wrong')
      if (typeof this.activeProjectId !== 'number') throw new Error('Something went terribly wrong')
      if (!this.overlayWindow || this.overlayWindow?.isDestroyed?.()) throw new Error('Overlay window does not exist');

      // make mouse events "go through" this current window (always-on-top)
      this.overlayWindow?.setIgnoreMouseEvents?.(true);

      // call the cleanup and refresh context function
      this.onMarkAreaDone();

      // emit the status text if its defined
      if (statusText) {
        this.overlayWindow?.webContents.send('mark-area-status', { statusText, statusDescription });
      }

      try {
        // first, create new observation draft, to obtain observation id
        const { id: obsId } = await addObservation(
          this.apiHost,
          this.loginToken,
          this.activeProjectId,
        );

        // take scrollshot/screenshot ('callback' argument)
        const filePath = await callback(
          area,
          this.getActiveDisplay(),
          this.activeDisplayIndex,
          () => this.cancelOperation,
        );

        // close overlay now that upload is done
        this.cancelOverlay();

        // open observation form window
        this.openCreateObservationWindow(obsId, true);

        // upload the image
        await this.uploadObservationImage(obsId, filePath, this.activeProjectId);

      } catch (e: any) {
        // TODO: report errors
        // TODO: handle errors better
        if (e?.message !== 'Cancelled') {
          console.error(e);
          new Notification({
            title: 'ManuScrape',
            body: e?.message || 'Unknown error :(',
            icon: errorIcon,
          }).show();
        }
        this.cancelOverlay();
      } finally {
        this.cancelOperation = false;
        this.refreshShortcuts();
      }

      // TODO: remove temp file(s)
    };

    // add listener to state so it can be removed later
    // NOTE: removeEventListener requires a reference to the function
    this.setOnAreaMarkedListener(handler);
  }


  public async openUploadObservationWindow() {
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

    // add empty observation and use returned id to modify observation
    const res = await addObservation(
      this.apiHost,
      this.loginToken,
      this.activeProjectId
    );
    const observationId = res.id;

    // open observation window without waiting for manual image upload
    return this.openCreateObservationWindow(observationId, false);
  }


  private async openCreateObservationWindow(
    observationId: number,
    automaticImageUpload: boolean
  ) {
    // makes typescript linters happy
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

    // create add observation window using observation id
    const win = createAddObservationWindow(
      this.apiHost,
      this.activeProjectId,
      observationId,
      () => this.onExternalWindowClose(),
      undefined,
      automaticImageUpload,
      true,
    );

    // add observation-created listener
    ipcMain.once('observation-created', (res) => {
      if (this.nuxtWindow?.isDestroyed() === false) {
        this.nuxtWindow.close();
      }
      if (this.overlayWindow?.isDestroyed() === false) {
        this.overlayWindow.close();
      }

      new Notification({
        title: 'ManuScrape',
        body: 'Observation created successfully',
        icon: successIcon,
      }).show();
    });

    // safe window in instance state
    this.nuxtWindow = win;
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
    } catch (err: any) {
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
      this.refreshShortcuts();

      try {
        // use retrieved 'host' and 'token' to renew cookie and fetch user
        if (host && token) {
          await renewCookieFromToken(host, token).catch(() => { });
          await this.refreshUser(host, token);
          this.refreshContextMenu();
        }
        // show login window if not logged in by now
        if (!this.isLoggedIn()) {
          this.openAuthorizationWindow(false);
        }
      } catch (e: any) {
        // show login window if there was some kind of error
        // TODO: report error
        this.openAuthorizationWindow(false);
      }
    }
  }


  // try to reset state by removing listeners and closing overlay
  public cancelOverlay() {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      ipcMain.removeAllListeners('area-marked');
      this.onMarkAreaDone();
      if (!this.overlayWindow?.isDestroyed()) {
        this.overlayWindow.close();
      }
    }
  }


  // try to reset state by removing listeners and closing overlay
  public cancelNuxtWindow() {
    if (this.nuxtWindow && !this.nuxtWindow.isDestroyed()) {
      ipcMain.removeAllListeners('area-marked');
      ipcMain.removeAllListeners('observation-created');
      ipcMain.removeAllListeners('project-created');
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
        new Notification({
          title: 'ManuScrape',
          body: 'Signed in with ' + user?.email + '.',
          icon: successIcon,
        }).show();

        // save login session if encryption is available
        if (this.useEncryption) {
          saveFile(host, this.hostPath);
          saveFile(token, this.tokenPath);
        }
      }
    } catch (e) {
      console.error(e);
      // TODO: report error
      // ignore expired/bad token
    }
  }


  // reset auth session and update UI accordingly
  private async resetAuth() {
    // call logout api
    if (this.apiHost && this.loginToken) {
      await logout(this.apiHost, this.loginToken);
    } else {
      console.warn('Token was not present when calling log out endpoint');
      // TODO: report this error
    }

    // update context menu and state
    this.user = undefined;
    this.loginToken = undefined;
    this.refreshContextMenu();


    // remove authorization cookies
    // NOTE: it skips silently if there is none
    await removeAuthCookies();

    // delete saved token file
    // NOTE: it skips silently if there is none
    deleteFile(this.tokenPath);

    // create delicious notification
    new Notification({
      title: 'ManuScrape',
      body: 'Signed out successfully.',
      icon: successIcon,
    }).show();

  }


  // open markArea overlay. IPC listeners should have be added beforehand
  private openMarkAreaOverlay() {
    if (this.overlayWindow && !this.overlayWindow?.isDestroyed?.()) {
      throw new Error('Overlay window is already active');
    }
    this.isMarkingArea = true;
    this.overlayWindow = createOverlayWindow(this.getActiveDisplay());
    this.refreshContextMenu();
    globalShortcut.unregister('Alt+C')
    globalShortcut.register('Alt+C', () => {
      this.cancelOverlay();
      this.cancelOperation = true;
    });
  }


  private async signInHandler(
    event: Electron.IpcMainEvent,
    { email, password, host }: ISignInBody,
  ): Promise<void> {
    // define initial token (to keep it in scope outside try/catch block)
    let token: string | undefined;

    // parse and set token and host variables
    try {
      // validate and set host url string
      host = parseHostUrl(host);

      // unpack in try catch to ensure token value in runtime
      const { token: _token } = await signIn(host, email, password);
      token = _token;

      // return `error` to client, so error can be rendered
    } catch (err: any) {
      return event.reply(
        'sign-in-error',
        err?.message || 'Unknown error'
      ) // TODO: use enum
    }

    await this.updateAuthSession(host, token);

    // tell client login was successful
    event.reply('sign-in-ok'); // TODO: use enum
  }


  private async signUpHandler(
    event: Electron.IpcMainEvent,
    { email, password, host }: ISignUpBody,
  ): Promise<void> {
    // define initial token (to keep it in scope outside try/catch block)
    let token: string | undefined;

    // parse and set token and host variables
    try {
      // validate and set host url string
      host = parseHostUrl(host);

      // unpack in try catch to ensure token value in runtime
      const { token: _token } = await signUp(host, email, password);
      token = _token;

      // return `error` to client, so error can be rendered
    } catch (err: any) {
      return event.reply(
        'sign-up-error',
        err?.message || 'Unknown error'
      ) // TODO: use enum
    }

    await this.updateAuthSession(host, token);

    // tell client login was successful
    event.reply('sign-up-ok'); // TODO: use enum
  }

  private clearAuthIpcListeners() {
    // clear existing relevant ipcMain listeners
    ipcMain.removeAllListeners('sign-in');
    ipcMain.removeAllListeners('sign-up');
    ipcMain.removeAllListeners('ask-for-default-host-value');
  }

  private async updateAuthSession(host: string, token: string) {
    // update cookie so browser window is logged in by default
    // TODO: this might not be needed
    await renewCookieFromToken(host, token);

    // try fetch user with token
    // NOTE: this confirms that the token works, and saves credentials in safeStorage
    await this.refreshUser(host, token);

    // clear existing relevant ipcMain listeners
    this.clearAuthIpcListeners();

    // refresh context menu, now that we are logged in
    this.refreshContextMenu();

    // TODO: also close existing open windows? maybe a reset windows method?
  }

  public openAuthorizationWindow(openSignUp = false) {
    // navigate automatically if window is open
    if (this.authWindow && !this.authWindow.isDestroyed()) {

      // get html file url
      const url = this.authWindow.webContents.getURL();

      // if mismatch between what is requested and what page is currently active,
      // load the url of the requested page
      if (url.endsWith('signIn.html') && openSignUp) {
        this.authWindow.loadFile('windows/signUp.html');
      } else if (url.endsWith('signUp.html') && !openSignUp) {
        this.authWindow.loadFile('windows/signIn.html');
      }

      // no matter what, focus the authWindow
      this.authWindow.focus();
    } else {
      // clear existing relevant ipcMain listeners
      this.clearAuthIpcListeners();

      // attach new event listeners
      // TODO: cleanup and use best ipc practices
      ipcMain.on(
        'sign-in', // TODO: use enum
        (event, body) => this.signInHandler(event, body),
      );
      ipcMain.on(
        'sign-up', // TODO: use enum
        (event, body) => this.signUpHandler(event, body),
      );
      ipcMain.on('ask-for-default-host-value', (event) => {
        event.reply('default-host-value', this?.apiHost || '')
      })

      // create new sign in window
      this.authWindow = createAuthorizationWindow(openSignUp);
    }
  }


  // opens webapp (hopefully authorized always!)
  // TODO: refactor
  public async openCreateProjectWindow(): Promise<void> {
    if (!this.apiHost) {
      throw new Error('Api host not set when opening external browser window')
    }

    if (this.nuxtWindow && !this.nuxtWindow.isDestroyed()) {
      this.nuxtWindow.focus();
      return;
    }

    ipcMain.once('project-created', (res) => {
      if (this.nuxtWindow && !this.nuxtWindow.isDestroyed()) {
        this.nuxtWindow.close();
        new Notification({
          title: 'ManuScrape',
          body: 'Project created successfully',
          icon: successIcon,
        }).show();
        this.refreshContextMenu();
      }
    });

    const win = createAddProjectWindow(this.apiHost, () => this.onExternalWindowClose());
    this.nuxtWindow = win;
  }


  // reset hardcoded global shortcuts
  private refreshShortcuts(): void {
    globalShortcut.unregisterAll();
    globalShortcut.register('Alt+Q', () => {
      console.info('caught exit shortcut. will exit now');
      this.app.exit(0)
    })
    globalShortcut.register('Alt+N', async () => {
      const confirmed = await this.confirmCloseNuxtWindowIfAny()
      if (!confirmed) {
        return;
      }
      if (!this.overlayWindow?.isDestroyed?.()) {
        this.overlayWindow?.close();
      }
      return this.createQuickScreenshot();
    })
    globalShortcut.register('Alt+S', async () => {
      const confirmed = await this.confirmCloseNuxtWindowIfAny()
      if (!confirmed) {
        return;
      }
      if (!this.overlayWindow?.isDestroyed?.()) {
        this.overlayWindow?.close();
      }
      return this.createScrollScreenshot();
    })
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
      this.refreshShortcuts();
    }
  }


  // refresh the context menu ui based on state of current ManuController instance
  private refreshContextMenu(): void {
    if (!this.tray) {
      throw new Error('Cannot refresh contextmenu, when tray app is not running')
    }
    this.contextMenu = generateContextMenu(this, this.user);
    this.tray.setContextMenu(this.contextMenu);
  }
}
