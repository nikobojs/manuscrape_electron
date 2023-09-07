import * as fs from 'fs';
import * as axios from 'axios';

// fetch decoration function to be used instead of fetch() when calling the nuxt api
// NOTE: there is no runtime validation against the generic type
async function req<T>(
    host: string,
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: RequestInfo | URL,
    token?: string,
    body?: Record<string, string> | FormData,
    headers?: HeadersInit,
): Promise<{res: Response, json: T}> {
    try {
        // define initial request config
        const init: RequestInit = {
            method,
            headers: {
                'Accept': 'application/json',
            },
            credentials: 'include',
        };

        // add json body and header if body is defined
        if (body && !(body instanceof FormData)) {
            init.body = JSON.stringify(body);
            init.headers = {
                ...init.headers,
                'Content-Type':  'application/json',
            };
        }

        // add custom headers if defined
        if (headers) {
            init.headers = {...init.headers, ...headers};
        }

        // add token header if token is defined
        if (token) {
            init.headers = {
                ...init.headers,
                'Authentication': token,
            }
        }

        // send api request
        // NOTE: might throw connection errors
        const res = await fetch(host + path, init);

        // parse json
        // NOTE: might throw json parse errors
        const json = await res.json();

        // if api returns message or statusMessage, throw error with server message
        if (![200, 201].includes(res.status)) {
            const msg =  json?.message || json?.statusMessage || 'Unknown error'
            throw new Error(msg)
        }

        // return the json body as the generic type
        // NOTE: there is no runtime validation in this generic function
        return {res, json: json as T};
    } catch(err: any) {
      // covers basic errors for bad hosts
      // TODO: improve error handling for more error cases
      if (err?.cause) {
        if (['EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED'].includes(err.cause?.code)) {
          throw new Error('The host is invalid or not available');
        } else if (err.cause?.code == 'ERR_SSL_WRONG_VERSION_NUMBER') {
          throw new Error('This kind of URL is invalid. Please specify the protocol.');
        }
      }

      // catch if server is not sending json
      if (err?.name === 'SyntaxError' && err?.message?.includes?.('Unexpected token')) {
        // TODO: report this
        throw new Error('The server probably down! Please contact your software provider')
      }

      // TODO: catch json parse errors
      console.error('req() UNCAUGHT ERROR:', {
        path,
        method,
        body,
        err: {
            name: err?.name, message: err?.message, cause: err?.cause
        }
    });

      // TODO: report uncaught errors

      // throw error
      throw err;
    }
}


export async function fetchUser(
    host: string,
    token: string
): Promise<IUser> {
    const  { json } = await req<IUser>(host, 'GET', '/api/user', token);
    return json;
}


export async function uploadObservationImage(
    host: string,
    token: string,
    observationId: number,
    projectId: number,
    filePath: string,
): Promise<void> {
    const form = new FormData();
    const buffer = fs.readFileSync(filePath);
    const fname = 'image';
    const extension = '.' + filePath.split('.').reverse()[0];
    const fullFname = fname + extension;
    const mimetype = ['jpg', 'jpeg'].includes(extension.toLowerCase()) ? 'image/jpg' : 'image/png';
    const blob = new Blob([buffer], {type: mimetype});
    form.append('file', blob, fullFname);

    const res = await axios.default.put(
        `${host}/api/projects/${projectId}/observations/${observationId}/image`,
        form,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
                'Authentication': token
            }
        }
    );

    return res.data;
}


export async function signUp(
    host: string,
    email: string,
    password: string
): Promise<ITokenResponse> {
    const { json } = await req<ITokenResponse>(host, 'POST', '/api/user', undefined, { email, password })

    // if we still dont have a token, we have to blame the api
    if (!json?.token || typeof json?.token !== 'string') {
        throw new Error('The server did not return the token.');
    }
    return json;
}


export async function signIn(
    host: string,
    email: string,
    password: string
): Promise<ITokenResponse> {
    const { json } = await req<ITokenResponse>(host, 'POST', '/api/auth', undefined, { email, password })

    // if we still dont have a token, we have to blame the api
    if (!json?.token || typeof json?.token !== 'string') {
        throw new Error('The server did not return the token.');
    }
    return json;
}


export async function logout(
    host: string,
    token: string
): Promise<Response> {
    const { res } = await req<ISuccessResponse>(host, 'DELETE', '/api/auth', token)
    return res;
}


export async function renewCookie(
    host: string,
    token: string
): Promise<Response> {
    const { res } = await req<ISuccessResponse>(host, 'POST', '/api/token_auth', undefined, { token })
    return res;
}


export async function addObservation(
    host: string,
    token: string,
    projectId: number,
): Promise<IObservationCreatedResponse> {
    const { json } = await req<IObservationCreatedResponse>(
        host,
        'POST',
        `/api/projects/${projectId}/observations`,
        token
    )

    // const json = await res.json();
    if (typeof json['id'] !== 'number') {
        console.error('Create observation response:', { json })
        throw new Error('Api did not respond as expected when creating observation');
    } else {
        return { id: json['id'] };
    }
}


export function parseHostUrl(
    host: string
): string {
    // ensure host is thruthy and a string
    if (!host || typeof host != 'string') {
        throw new Error('Host parameter is required');
    }

    // if no scheme is set, default to https
    const hasProtocol = /^.+\:\/\//.test(host);
    if (!hasProtocol) {
      host = 'https://' + host;
    }

    try {
      const parsedUrl = new URL(host);

      // only allow http and https
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('The host input field must begin with http:// or https://');
      }
    } catch {
        throw new Error('Invalid host input value');
    }

    // return host
    return host;
}
