import {
  app,
  Notification,
  screen,
  Tray,
  ipcMain,
  Menu,
  globalShortcut,
  BrowserWindow,
  type IpcMainEvent,
} from "electron";
import path from "path";
import {
  quickScreenshot,
  captureScrollshot,
  processScrollshot,
} from "./helpers/screenshots";
import {
  createOverlayWindow,
  createSettingsWindow,
  createAuthorizationWindow,
  createAddProjectWindow,
  createAddObservationWindow,
  createDraftsWindow,
} from "./helpers/browserWindows";
import { trayIcon, successIcon, errorIcon, warningIcon } from "./helpers/icons";
import {
  fetchUser,
  logout,
  signIn,
  addObservation,
  signUp,
  parseHostUrl,
  isClientDeprecationError,
  getProject,
  deleteObservation,
} from "./helpers/api";
import {
  selectProjectField,
  warnIfScreenIsNotAccessible,
  yesOrNo,
} from "./helpers/utils";
import {
  authCookieExists,
  getInvalidationCookie,
  readTokenFromCookie,
  removeAuthCookies,
  renewCookieFromToken,
} from "./helpers/cookies";
import { generateContextMenu } from "./helpers/contextMenu";
import {
  fileExists,
  readFile,
  saveFile,
  deleteFile,
} from "./helpers/safeStorage";
import {
  initializeSettings,
  saveSettingsToFile,
  validateSettings,
} from "./helpers/settings";
import fs from "fs";

export class ManuScrapeController {
  public isMarkingArea: boolean;
  public allDisplays: Array<Electron.Display>;
  public activeProjectId: number | undefined;
  public activeObservationId: number | undefined;
  public activeDisplayIndex: number;
  public version: string;

  private app: Electron.App;
  private trayWindow: Electron.BrowserWindow | undefined;
  private authWindow: Electron.BrowserWindow | undefined;
  private nuxtWindow: Electron.BrowserWindow | undefined;
  private settingsWindow: Electron.BrowserWindow | undefined;
  private overlayWindow: Electron.BrowserWindow | undefined;
  private onAreaMarkedListener:
    | ((event: IpcMainEvent, ...args: any[]) => Promise<void>)
    | undefined;
  private tray: Tray | undefined;
  private loginToken: string | undefined;
  private apiHost: string | undefined;
  private tokenPath: string;
  private hostPath: string;
  private settingsPath: string;
  private user: IUser | undefined;
  private contextMenu: Menu | undefined;
  private useEncryption: boolean;
  private cancelOperation: boolean;
  private settings: ISettings;

  constructor(
    trayWindow: BrowserWindow,
    useEncryption: boolean,
    version: string,
  ) {
    this.app = app;
    this.allDisplays = screen.getAllDisplays();
    this.activeDisplayIndex = 0;
    this.isMarkingArea = false;
    this.cancelOperation = false;
    this.tokenPath = path.join(app.getPath("userData"), "token.txt.enc");
    this.hostPath = path.join(app.getPath("userData"), "host.txt.enc");
    this.settingsPath = path.join(app.getPath("userData"), "settings.txt.enc");
    this.useEncryption = useEncryption;
    this.settings = initializeSettings(this.settingsPath);
    this.version = version;
    this.activeObservationId = undefined;

    console.info(`Initializing ManuScrape Client v${version}...\n`);

    ipcMain.on("get-version-request", (event) => {
      event.reply("get-version-response", this.version);
    });

    ipcMain.on("observation-image-uploaded", () => {
      this.cancelActiveObservation();
    });

    trayWindow.on("ready-to-show", () => {
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
        this.tray.setContextMenu(this.contextMenu);
      } else {
        throw new Error("Tray menu cannot open without menu items");
      }
      this.tray.popUpContextMenu();
    } else {
      throw new Error(
        "Unable to open context menu, when tray app is not running",
      );
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

  public getSettings(): ISettings {
    return this.settings;
  }

  // logged in helper
  public isLoggedIn(): boolean {
    return !!this.loginToken;
  }

  // log out function
  public async logOut(): Promise<void> {
    if (!this.trayWindow) {
      throw new Error("Tray window is not defined");
    }

    const yes = yesOrNo("Are you sure you want to log out?");
    if (yes) {
      return this.resetAuth();
    }
  }

  // update activeProjectId and refresh menu
  public chooseProject(id: number) {
    this.activeProjectId = id;
    this.activeObservationId = undefined;
    this.refreshContextMenu();
  }

  // create new quick screenshot
  public async createQuickScreenshot(): Promise<void> {
    // ensure there is not already an observation being made
    const confirmed = await this.confirmCloseNuxtWindowIfAny();
    if (!confirmed) {
      return;
    }

    warnIfScreenIsNotAccessible();

    // generate callback function that utilizes quickScreenshot
    this.useOnMarkedAreaCallback(quickScreenshot);

    // now once listeners are attached, open mark area overlay
    this.openMarkAreaOverlay();
  }

  // create new scroll screenshot
  public async createScrollScreenshot(): Promise<void> {
    // ensure there is not already an observation being made
    const confirmed = await this.confirmCloseNuxtWindowIfAny();
    if (!confirmed) {
      return;
    }

    warnIfScreenIsNotAccessible();

    // define callback function
    const scrollshotHandler = async (event: IpcMainEvent, area: any) => {
      const apiHost = this.requireApiHost();
      const loginToken = this.requireLoginToken();
      const activeProjectId = this.requireActiveProjectId();

      // define here so we can delete it after upload in the finally block
      let filePath: undefined | string;

      // make mouse events "go through" this current window (always-on-top)
      this.overlayWindow?.setIgnoreMouseEvents?.(true);

      // call the cleanup and refresh context function
      this.onMarkAreaDone();

      try {
        // emit primary status text
        this.overlayWindow?.webContents.send("mark-area-status", {
          statusText: "Recording scrollshot...",
          statusDescription: "Cancel: Alt+C   Save: Alt+S",
          hideArea: true,
        });

        const { dirname, lastSavePath, totalScreenshots } =
          await captureScrollshot(
            area,
            this.getActiveDisplay(),
            this.activeDisplayIndex,
            () => this.cancelOperation,
          );

        this.overlayWindow?.webContents.send("mark-area-status", {
          statusText: "Processing scrollshot...",
          statusDescription: "This will take a few seconds",
          hideArea: true,
        });

        const filePath = await processScrollshot(
          dirname,
          lastSavePath,
          totalScreenshots,
          this.settings.scrollshot,
          () => this.cancelOperation,
        );

        // close overlay now that saving is done
        this.cancelOverlay();

        // create new observation draft, to obtain observation id, unless there is an active observation id
        let obsId = this.activeObservationId;
        if (!obsId) {
          const newObs = await addObservation(
            apiHost,
            loginToken,
            activeProjectId,
          );
          obsId = newObs.id;
        }

        // open observation form window
        await this.openCreateObservationWindow(obsId, loginToken, filePath);
      } catch (e: any) {
        this.handleScreenshotError(e);
      } finally {
        this.wrapUpScreenshot(filePath);
      }
    };

    // add listener to state so it can be removed later
    // NOTE: removeEventListener requires a reference to the function
    this.setOnAreaMarkedListener(scrollshotHandler);

    // now once listeners are attached, open mark area overlay
    this.openMarkAreaOverlay();
  }

  public cancelActiveObservation() {
    this.activeObservationId = undefined;
    this.refreshContextMenu();
  }

  private handleScreenshotError(e: any) {
    // TODO: report errors
    // TODO: handle errors better
    if (e?.message !== "Cancelled") {
      console.error(e);
      new Notification({
        title: "ManuScrape",
        body: e?.message || "Unknown error :(",
        icon: errorIcon,
      }).show();
    }

    this.cancelOperation = true;
    this.cancelNuxtWindow();
    this.cancelOverlay();
  }

  private wrapUpScreenshot(filePath?: string) {
    // remove temp file
    if (filePath) {
      fs.rmSync(filePath);
    }
    this.cancelOperation = false;
    this.refreshShortcuts();
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
    hideArea = false,
  ): void {
    const handler = async (event: IpcMainEvent, area: any) => {
      const apiHost = this.requireApiHost();
      const loginToken = this.requireLoginToken();
      const activeProjectId = this.requireActiveProjectId();

      if (!this.overlayWindow || this.overlayWindow?.isDestroyed?.())
        throw new Error("Overlay window does not exist");

      // define here so we can delete it after upload in the finally block
      let filePath: undefined | string;

      // make mouse events "go through" this current window (always-on-top)
      this.overlayWindow?.setIgnoreMouseEvents?.(true);

      // call the cleanup and refresh context function
      this.onMarkAreaDone();

      // emit the status text if its defined
      if (statusText) {
        this.overlayWindow?.webContents.send("mark-area-status", {
          statusText,
          statusDescription,
          hideArea,
        });
      }

      try {
        // create new observation draft, to obtain observation id, unless there is an active observation id
        let obsId = this.activeObservationId;
        if (!obsId) {
          const newObs = await addObservation(
            apiHost,
            loginToken,
            activeProjectId,
          );
          obsId = newObs.id;
        }

        // take scrollshot/screenshot ('callback' argument)
        filePath = await callback(
          area,
          this.getActiveDisplay(),
          this.activeDisplayIndex,
          () => this.cancelOperation,
        );

        // close overlay now that saving is done
        this.cancelOverlay();

        // open observation form window
        await this.openCreateObservationWindow(obsId, loginToken, filePath);
      } catch (e: any) {
        console.log(e);
        this.handleScreenshotError(e);
      } finally {
        this.wrapUpScreenshot(filePath);
      }
    };

    // add listener to state so it can be removed later
    // NOTE: removeEventListener requires a reference to the function
    this.setOnAreaMarkedListener(handler);
  }

  public async openEmptyDraftWindow() {
    const apiHost = this.requireApiHost();
    const loginToken = this.requireLoginToken();
    const activeProjectId = this.requireActiveProjectId();

    // return early if user mistakenly opens one more window
    const confirmed = await this.confirmCloseNuxtWindowIfAny();
    if (!confirmed) {
      return;
    }

    // add empty observation and use returned id to modify observation
    const res = await addObservation(apiHost, loginToken, activeProjectId);
    const observationId = res.id;

    // open observation window without waiting for manual image upload
    return this.openCreateObservationWindow(
      observationId,
      loginToken,
      undefined,
    );
  }

  private async openCreateObservationWindow(
    observationId: number,
    accessToken: string,
    imgFilePath: string | undefined,
  ) {
    const apiHost = this.requireApiHost();
    const activeProjectId = this.requireActiveProjectId();

    // TODO: create project field parameter window
    const project = await getProject(apiHost, accessToken, activeProjectId);

    const imageProjectFields = project.fields.filter((f) =>
      ["IMAGE_SINGLE", "IMAGE_MULTIPLE"].includes(f.type),
    );

    let chosenField: SmallProjectFieldResponse | null = null;
    if (imageProjectFields.length === 0) {
      // TODO: export + handle error
    } else if (imageProjectFields.length === 1) {
      chosenField = imageProjectFields[0];
    } else if (imageProjectFields.length > 1) {
      chosenField = selectProjectField(
        "Select which project field you want to add the image to.",
        imageProjectFields,
      );
    }

    if (!chosenField) {
      await deleteObservation(
        apiHost,
        accessToken,
        activeProjectId,
        observationId,
      );
      return;
    }

    // add observation-created listener
    ipcMain.once("observation-created", (event) => {
      // This ensures that the window of the event closes
      const webContents = event.sender;
      webContents.close();

      // I think this can be safely removed
      if (!this.nuxtWindow?.isDestroyed()) {
        this.nuxtWindow?.webContents.close();
      }
      if (this.overlayWindow?.isDestroyed() === false) {
        this.overlayWindow?.webContents.close();
      }

      new Notification({
        title: "ManuScrape",
        body: "Observation created successfully",
        icon: successIcon,
      }).show();

      // reset active observation id if any
      this.cancelActiveObservation();
    });

    ipcMain.once(
      "prepare-next-screenshot", // TODO: use enum
      (event, obsId: number) => {
        // make sure observation id is a number
        if (typeof obsId !== "number") {
          // TODO: report error
          new Notification({
            title: "ManuScrape",
            body: "Unable to use this feature",
            icon: errorIcon,
          }).show();
          return;
        }

        // close existing stuff
        if (!this.nuxtWindow?.isDestroyed()) {
          this.nuxtWindow?.webContents.close();
        }
        if (this.overlayWindow?.isDestroyed() === false) {
          this.overlayWindow?.webContents.close();
        }

        // save observation id to the next screenshot
        this.activeObservationId = obsId;
        this.refreshContextMenu();
      },
    );

    const onWindowClose = () => {
      ipcMain.removeAllListeners("observation-created");
      ipcMain.removeAllListeners("prepare-next-screenshot");
      this.syncAuthStateAndMenu();
    };

    // create add observation window using observation id
    const win = await createAddObservationWindow(
      apiHost,
      activeProjectId,
      observationId,
      onWindowClose,
      undefined,
      true,
      imgFilePath,
      chosenField.id,
    );

    // safe window in instance state
    this.nuxtWindow = win;
  }

  // ensure not more than one app window
  private async confirmCloseNuxtWindowIfAny(): Promise<boolean> {
    if (this.nuxtWindow && !this.nuxtWindow.isDestroyed()) {
      this.nuxtWindow.webContents.focus();
      const yes = yesOrNo(
        "Are you sure you want to close the existing window?",
      );
      if (yes) {
        this.cancelNuxtWindow();
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
        console.info("signing in with token and host files");
        token = readFile(this.tokenPath);
        // if host file exists and cookie exists, extract token from cookie
        // TODO: fix pattern
      } else if (hasAuthCookie && hostExists) {
        console.info("signing in with cookie and saved host file");
        token = await readTokenFromCookie();
      }
    } catch (err: any) {
      // TODO: report errors?
      // TODO: test for specific errors
      console.warn("Ignoring error when authorizing intially:");
      console.warn(err);

      // TODO: report specific errors to user (os notifications?)
      if (/fetch\ failed/i.test(err?.message)) {
        console.error("Unable to connect to host");
      }
    } finally {
      // TODO: weird bug requries refreshContext to be called twice
      // context popup wont show unless refreshContextMenu is called twice
      this.refreshContextMenu();
      this.refreshShortcuts();

      try {
        // use retrieved 'host' and 'token' to renew cookie and fetch user
        if (host && token) {
          await renewCookieFromToken(host, token);
          await this.refreshUser(host, token);
          this.refreshContextMenu();
        }
        if (!this.isLoggedIn()) {
          // show login window if not logged in by now
          this.openAuthorizationWindow(false);
        } else if (this.user?.projectAccess.length === 0) {
          // if no projects available for user, open createProjects window
          await this.openCreateProjectWindow();
        }
      } catch (e: any) {
        // show login window if there was some kind of error
        // TODO: report error
        const tooOld = isClientDeprecationError(e);
        this.openAuthorizationWindow(false, tooOld);
      }
    }
  }

  // try to reset state by removing listeners and closing overlay
  public cancelOverlay() {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      ipcMain.removeAllListeners("area-marked");
      this.onMarkAreaDone();
      this.overlayWindow.webContents.close();
    }
  }

  // try to reset state by removing listeners and closing overlay
  public cancelNuxtWindow() {
    if (this.nuxtWindow && !this.nuxtWindow.isDestroyed()) {
      ipcMain.removeAllListeners("area-marked");
      this.onMarkAreaDone();
      this.nuxtWindow.webContents.close();
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
          title: "ManuScrape",
          body: "Signed in with " + user?.email + ".",
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
    // ask for confirmation for closing open window if any
    const confirmed = await this.confirmCloseNuxtWindowIfAny();
    if (!confirmed) {
      return;
    }

    // call logout api
    if (this.apiHost && this.loginToken) {
      await logout(this.apiHost, this.loginToken);
    } else {
      console.warn("Token was not present when calling log out endpoint");
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
      title: "ManuScrape",
      body: "Signed out successfully.",
      icon: successIcon,
    }).show();
  }

  // open markArea overlay. IPC listeners should have be added beforehand
  private openMarkAreaOverlay() {
    if (this.overlayWindow && !this.overlayWindow?.isDestroyed?.()) {
      this.overlayWindow.webContents.close();
    }
    this.isMarkingArea = true;
    this.overlayWindow = createOverlayWindow(this.getActiveDisplay());
    this.refreshContextMenu();
    globalShortcut.unregister("Alt+C");
    globalShortcut.unregister("Esc");
    globalShortcut.register("Alt+C", () => {
      this.cancelOverlay();
      this.cancelOperation = true;
    });
    globalShortcut.register("Esc", () => {
      this.cancelOverlay();
      this.cancelOperation = true;
    });
  }

  private async signInHandler(
    event: Electron.IpcMainEvent,
    { email, password, host }: ISignInBody,
  ): Promise<void> {
    // reset important state variables
    this.activeObservationId = undefined;
    this.activeProjectId = undefined;

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
      if (isClientDeprecationError(err)) {
        event.reply("client-is-deprecated", err?.message);
      }
      return event.reply("sign-in-error", err?.message || "Unknown error"); // TODO: use enum
    }

    await this.updateAuthSession(host, token);

    // tell client login was successful
    event.reply("sign-in-ok"); // TODO: use enum
  }

  // update local settings based on patch event via ipc
  private async updateSettingsHandler(
    event: Electron.IpcMainEvent,
    patch: ISettings,
  ): Promise<void> {
    // TODO: use deep merge instead
    const patchedSettings = {
      ...this.settings,
      scrollshot: {
        ...this.settings.scrollshot,
        ...patch.scrollshot,
      },
    };
    const errors = validateSettings(patchedSettings);

    if (errors.length > 0) {
      return event.reply("update-settings-error", errors.join("\n")); // TODO: use enum
    }

    // no errors, lets patch it
    this.settings = patchedSettings;

    // TODO: save to disk???
    saveSettingsToFile(this.settingsPath, this.settings);

    // show success notification
    new Notification({
      title: "ManuScrape",
      body: "Settings updated successfully",
      icon: successIcon,
    }).show();

    // reply to frontend that the patch went well
    event.reply("update-settings-ok", patchedSettings);
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
      return event.reply("sign-up-error", err?.message || "Unknown error"); // TODO: use enum
    }

    await this.updateAuthSession(host, token);

    // tell client login was successful
    event.reply("sign-up-ok"); // TODO: use enum
  }

  private clearAuthIpcListeners() {
    // clear existing relevant ipcMain listeners
    ipcMain.removeAllListeners("sign-in");
    ipcMain.removeAllListeners("sign-up");
    ipcMain.removeAllListeners("ask-for-default-host-value");
    ipcMain.removeAllListeners("ask-for-error-message");
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

    if (this.user?.projectAccess.length === 0) {
      // if no projects available for user, open createProjects window
      await this.openCreateProjectWindow();
    }
    // TODO: also close existing open windows? maybe a reset windows method?
  }

  public openAuthorizationWindow(openSignUp = false, clientIsTooOld = false) {
    // navigate automatically if window is open
    if (this.authWindow && !this.authWindow.isDestroyed()) {
      // get html file url
      const url = this.authWindow.webContents.getURL();

      // if mismatch between what is requested and what page is currently active,
      // load the url of the requested page
      if (url.endsWith("signIn.html") && openSignUp) {
        this.authWindow.loadFile("windows/signUp.html");
      } else if (url.endsWith("signUp.html") && !openSignUp) {
        this.authWindow.loadFile("windows/signIn.html");
      }

      // no matter what, focus the authWindow
      this.authWindow.focus();
    } else {
      // clear existing relevant ipcMain listeners
      this.clearAuthIpcListeners();

      // attach new event listeners
      // TODO: cleanup and use best ipc practices
      ipcMain.on(
        "sign-in", // TODO: use enum
        (event, body) => this.signInHandler(event, body),
      );
      ipcMain.on(
        "sign-up", // TODO: use enum
        (event, body) => this.signUpHandler(event, body),
      );
      ipcMain.on("ask-for-default-host-value", (event) => {
        event.reply("default-host-value", this?.apiHost || "");
      });
      ipcMain.on("ask-client-is-deprecated", (event) => {
        if (clientIsTooOld) {
          event.reply("client-is-deprecated");
        }
      });

      // create new sign in window
      this.authWindow = createAuthorizationWindow(openSignUp);
    }
  }

  public openSettingsWindow() {
    const apiHost = this.requireApiHost();

    // navigate automatically if window is open
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      // focus the authWindow if its already open
      this.settingsWindow.focus();
    } else {
      // create new sign in window
      this.settingsWindow = createSettingsWindow(
        apiHost,
        () => this.getSettings(),
        (event, patch) => this.updateSettingsHandler(event, patch),
      );
    }
  }

  // opens webapp (hopefully authorized always!)
  // TODO: refactor
  public async openCreateProjectWindow(): Promise<void> {
    const apiHost = this.requireApiHost();

    const confirmed = await this.confirmCloseNuxtWindowIfAny();
    if (!confirmed) {
      return;
    }

    // handle when frontend emits project-created event, with a project id
    ipcMain.once("project-created", async (_event, data: { id: number }) => {
      if (this.nuxtWindow && !this.nuxtWindow.isDestroyed()) {
        this.nuxtWindow.webContents.close();

        new Notification({
          title: "ManuScrape",
          body: "Project created successfully",
          icon: successIcon,
        }).show();

        const apiHost = this.requireApiHost();
        const loginToken = this.requireLoginToken();
        await this.refreshUser(apiHost, loginToken);

        // choose the project
        if (typeof data?.id === "number") {
          this.chooseProject(data.id); // also refreshes context manu
        } else {
          console.error("project-created event did not return a project id");
          // TODO: report error
        }
      }
    });

    const onWindowClose = () => {
      this.syncAuthStateAndMenu();
      ipcMain.removeAllListeners("project-created");
    };

    const win = createAddProjectWindow(apiHost, onWindowClose);
    this.nuxtWindow = win;
  }

  // opens observation drafts window
  public async openObservationDraftsWindow(): Promise<void> {
    this.activeObservationId = undefined;
    const apiHost = this.requireApiHost();
    const activeProjectId = this.requireActiveProjectId();

    // close nuxt window if existing
    const confirmed = await this.confirmCloseNuxtWindowIfAny();
    if (!confirmed) {
      return;
    }

    const onWindowClose = () => {
      this.syncAuthStateAndMenu();
    };

    // open drafts window
    const win = createDraftsWindow(apiHost, activeProjectId, onWindowClose);
    this.nuxtWindow = win;
  }

  // overwrites area-marked listener if it is already defined
  private setOnAreaMarkedListener(
    listener: (event: IpcMainEvent, ...args: any[]) => Promise<void>,
  ) {
    if (this.onAreaMarkedListener) {
      ipcMain.removeListener("area-marked", this.onAreaMarkedListener);
    }

    this.onAreaMarkedListener = listener;
    ipcMain.addListener("area-marked", listener);
  }

  private async syncAuthStateAndMenu() {
    const apiHost = this.requireApiHost();
    const invalidationCookie = await getInvalidationCookie(apiHost);

    if (invalidationCookie) {
      console.info("caught signed out in browser window");
      await this.resetAuth();
    } else if (this.isLoggedIn() && this.loginToken) {
      await this.refreshUser(apiHost, this.loginToken);
      this.refreshContextMenu();
      this.refreshShortcuts();
    }
  }

  // refresh the context menu ui based on state of current ManuController instance
  private refreshContextMenu(): void {
    if (!this.tray) {
      throw new Error(
        "Cannot refresh contextmenu, when tray app is not running",
      );
    }
    this.contextMenu = generateContextMenu(this, this.user);
    this.tray.setContextMenu(this.contextMenu);
  }

  // reset hardcoded global shortcuts
  private refreshShortcuts(): void {
    globalShortcut.unregisterAll();
    globalShortcut.register("Alt+Q", () => {
      console.info("caught exit shortcut. will exit now");
      this.app.exit(0);
    });

    globalShortcut.register("Alt+N", async () => {
      const confirmed = await this.confirmCloseNuxtWindowIfAny();
      if (!confirmed) {
        return;
      }
      if (!this.overlayWindow?.isDestroyed?.()) {
        this.overlayWindow?.webContents.close();
      }
      return this.createQuickScreenshot();
    });

    globalShortcut.register("Alt+S", async () => {
      const confirmed = await this.confirmCloseNuxtWindowIfAny();
      if (!confirmed) {
        return;
      }
      if (!this.overlayWindow?.isDestroyed?.()) {
        this.overlayWindow?.webContents.close();
      }
      return this.createScrollScreenshot();
    });
  }

  private requireActiveProjectId: () => number = () => {
    if (!this.activeProjectId) {
      console.error("No active project id");
      throw new Error("activeProjectId is not set");
    } else {
      return this.activeProjectId;
    }
  };
  private requireApiHost: () => string = () => {
    if (!this.apiHost) {
      console.error("No api host");
      throw new Error("apiHost is not set");
    } else {
      return this.apiHost;
    }
  };
  private requireLoginToken: () => string = () => {
    if (!this.loginToken) {
      console.error("No login token");
      throw new Error("loginToken not attached to controller instance");
    } else {
      return this.loginToken;
    }
  };
}
