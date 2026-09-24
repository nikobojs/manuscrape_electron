import { app, safeStorage, session } from "electron";
import { readFile, saveFile, deleteFile } from "./safeStorage";

// name of the session cookie set by the manuscrape api when signed in
const AUTH_COOKIE_NAME = "manuscrape-session";

// encrypted file used to remember the last login between app restarts.
// NOTE: only ever holds the single most recent login (host + cookie)
const authSessionPath = () =>
  app.getPath("userData") + "/auth-session.txt.enc";

// shape of the encrypted auth session record saved on disk
interface AuthSessionRecord {
  host: string;
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: Electron.CookiesSetDetails["sameSite"];
  expirationDate?: number;
}

// returns true when a cookie domain (like ".example.com") matches a hostname
function cookieDomainMatches(domain: string, hostname: string): boolean {
  const bare = domain.replace(/^\./, "");
  return hostname === bare || hostname.endsWith(`.${bare}`);
}

// read auth cookie(s) from chromium's cookie jar
export function readAuthCookies(): Promise<Electron.Cookie[]> {
  return session.defaultSession.cookies.get({ name: AUTH_COOKIE_NAME });
}

// read the auth cookie for a specific host from chromium's cookie jar
export async function readAuthCookieForHost(
  host: string,
): Promise<Electron.Cookie | undefined> {
  let hostname: string;
  try {
    hostname = new URL(host).hostname;
  } catch {
    return undefined;
  }
  const cookies = await readAuthCookies();
  return cookies.find(
    (cookie) =>
      !!cookie.domain && cookieDomainMatches(cookie.domain, hostname),
  );
}

// returns true if an auth cookie for the given host exists in the cookie jar
export async function authCookieExistsForHost(host: string): Promise<boolean> {
  return !!(await readAuthCookieForHost(host));
}

// remove the auth cookie for the given host from chromium's cookie jar
export async function removeAuthCookie(host: string): Promise<void> {
  try {
    await session.defaultSession.cookies.remove(host, AUTH_COOKIE_NAME);
  } catch (err) {
    // the cookie might not exist or the url might be invalid, which is fine
    console.warn("Ignored error when removing auth cookie:", err);
  }
}

// remove the auth cookie of every host except the given one, so the cookie
// jar never remembers logins for more than the last used host
export async function removeOtherHostAuthCookies(host: string): Promise<void> {
  let hostname: string;
  try {
    hostname = new URL(host).hostname;
  } catch {
    return;
  }
  const cookies = await readAuthCookies();
  for (const cookie of cookies) {
    if (!cookie.domain || cookieDomainMatches(cookie.domain, hostname)) {
      continue;
    }
    const scheme = cookie.secure ? "https://" : "http://";
    const url = scheme + cookie.domain.replace(/^\./, "");
    try {
      await session.defaultSession.cookies.remove(url, cookie.name);
    } catch (err) {
      console.warn("Ignored error when removing other host auth cookie:", err);
    }
  }
}

// remember the auth cookie for the given host on disk (encrypted), so the
// login survives app restarts even if the api uses session cookies that
// chromium only keeps in memory. overwrites any previously remembered login,
// so only the last login from the last host is ever remembered
export async function rememberAuthCookie(host: string): Promise<void> {
  if (!canStoreSecurely()) return;

  const cookie = await readAuthCookieForHost(host);
  if (!cookie) {
    console.warn("Cannot remember auth cookie that does not exist");
    return;
  }

  const record: AuthSessionRecord = {
    host,
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain ?? "",
    path: cookie.path ?? "/",
    secure: !!cookie.secure,
    httpOnly: !!cookie.httpOnly,
    sameSite: cookie.sameSite,
    expirationDate: cookie.expirationDate,
  };

  try {
    saveFile(JSON.stringify(record), authSessionPath());
    console.info("remembered auth cookie for", new URL(host).hostname);
  } catch (err) {
    // the login works for this session, it just will not be remembered
    console.warn("Unable to remember auth cookie:", err);
  }
}

// restore the remembered auth cookie into chromium's cookie jar, e.g. at
// app startup when the api session cookie was lost with the previous run.
// returns true if a cookie for the given host was restored
export async function restoreAuthCookie(host: string): Promise<boolean> {
  let record: AuthSessionRecord | undefined;
  try {
    record = JSON.parse(readFile(authSessionPath())) as AuthSessionRecord;
  } catch (err) {
    // no remembered login, or it could not be decrypted
    return false;
  }

  // only restore the login if it belongs to the host being connected to
  if (!record || record.host !== host || !record.value) {
    return false;
  }

  try {
    await session.defaultSession.cookies.set({
      url: host,
      name: record.name,
      value: record.value,
      domain: record.domain,
      path: record.path,
      secure: record.secure,
      httpOnly: record.httpOnly,
      sameSite: record.sameSite,
      expirationDate: record.expirationDate,
    });
    console.info("restored remembered auth cookie for", new URL(host).hostname);
    return true;
  } catch (err) {
    console.warn("Unable to restore remembered auth cookie:", err);
    return false;
  }
}

// forget the remembered auth cookie on disk, e.g. when logging out
export function forgetAuthCookie(): void {
  deleteFile(authSessionPath());
}

// react to the auth cookie being changed in chromium's cookie jar
// (added, rotated, removed or expired) — used to detect logouts and session
// expiries happening inside the nuxt browser windows
export function onAuthCookieChanged(
  callback: (cookie: Electron.Cookie, removed: boolean) => void,
): void {
  session.defaultSession.cookies.on(
    "changed",
    (_event, cookie, _cause, removed) => {
      if (cookie.name === AUTH_COOKIE_NAME) {
        callback(cookie, removed);
      }
    },
  );
}

// check that the remembered login can be stored securely on this machine
// NOTE: the record holds a credential, so it must be encrypted on disk
function canStoreSecurely(): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn(
      "Auth cookie will not be remembered: safeStorage unavailable",
    );
    return false;
  }
  return true;
}
