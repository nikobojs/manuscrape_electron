import { type Cookie, type CookiesSetDetails, session } from 'electron';
import * as cookie from 'cookie';
import { renewCookie } from './api';

// read auth cookie from response object and throw if its bad
export function parseAuthCookie(host: string, res: Response): CookiesSetDetails {
  const cookieVal = res.headers.get('Set-Cookie');
  if (!cookieVal) {
    throw new Error('The response headers does not include \'Set-Cookie\'');
  }
  const parsed = cookie.parse(cookieVal);
  const hostUrl = new URL(host);
  const newCookie: CookiesSetDetails = {
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


// Some small cookie helpers
export async function readAuthCookies(): Promise<Electron.Cookie[]> {
  const cookies = await session.defaultSession.cookies.get({ name: 'authcookie' })
  return cookies;
}
export async function authCookieExists(): Promise<boolean> {
  const cookies = await readAuthCookies();
  return cookies.length > 0;
}
export async function removeAuthCookies(): Promise<void> {
  const cookiesExist = await authCookieExists();
  if (cookiesExist) {
    const opts: Electron.ClearStorageDataOptions = {
      storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'serviceworkers'],
    };
    await session.defaultSession.clearStorageData(opts)
  }
}


// async function that returns token from first auth cookie
// and throws if none found
export async function readTokenFromCookie(): Promise<string> {
  const cookies = await readAuthCookies();
  if (cookies.length > 0) {
    const val = cookies[0].value;
    return val;
  } else {
    throw new Error('Cannot read cookie when it is not defined')
  }
}


// renew cookie from host and token
// - calls endpoint that returns a cookie based on a token
// - sets session cookie and saves it on client machine
export async function renewCookieFromToken(host: string, token: string): Promise<void> {
  const res = await renewCookie(host, token);
  const newCookie = parseAuthCookie(host, res);
  session.defaultSession.cookies.set(newCookie);
}


// find and return invalidation cookies saved in session if any
export async function getInvalidationCookie(
  host: string
): Promise<Cookie | undefined> {
    const hostUrl = new URL(host);
    const cookies = await readAuthCookies();
    const invalidationCookie = cookies.find((cookie) => 
      cookie.domain == hostUrl.hostname &&
      cookie.name === 'authcookie' &&
      cookie.value === ''
    );
    return invalidationCookie;
}
