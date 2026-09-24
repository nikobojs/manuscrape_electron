import { app, net } from "electron";

type ReqBodyVal =
  | string
  | number
  | boolean
  | null
  | { [key: string]: ReqBodyVal }
  | ReqBodyVal[];
type ReqBody = { [key: string]: ReqBodyVal };
const USER_AGENT = `ManuScrape/${app.getVersion()}`;

export function isClientDeprecationError(err: Error): boolean {
  return err?.message?.includes("is too old");
}

// fetch decoration function to be used instead of fetch() when calling the nuxt api
// uses electron's network stack (net.fetch), so chromium automatically attaches
// the auth cookie from the default session's cookie jar and stores any cookies
// the api sets, which means authentication needs no manual handling here
// NOTE: there is no runtime validation against the generic type
async function req<T>(
  host: string,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: RequestInfo | URL,
  body?: ReqBody,
  headers?: HeadersInit,
): Promise<{ res: Response; json: T }> {
  const start = Date.now();
  try {
    // define initial request config
    const init: RequestInit = {
      method,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      // include credentials so chromium attaches the auth cookie
      credentials: "include",
    };

    // add json body and header if body is defined
    if (body) {
      init.body = JSON.stringify(body);
      init.headers = {
        ...init.headers,
        "Content-Type": "application/json",
      };
    }

    // add custom headers if defined
    if (headers) {
      init.headers = { ...init.headers, ...headers };
    }

    // send api request
    // NOTE: might throw connection errors
    const res = await net.fetch(host + path, init);

    // parse json
    // NOTE: might throw json parse errors
    const json = await res.json();

    // if api returns message or statusMessage, throw error with server message
    if (![200, 201].includes(res.status)) {
      const msg = json?.message || json?.statusMessage || "Unknown error";
      throw new Error(msg);
    }

    // return the json body as the generic type
    // NOTE: there is no runtime validation in this generic function
    return { res, json: json as T };
  } catch (err: any) {
    // covers basic errors for bad hosts
    // TODO: improve error handling for more error cases
    if (err?.cause) {
      if (
        ["EAI_AGAIN", "ENOTFOUND", "ECONNREFUSED"].includes(err.cause?.code)
      ) {
        throw new Error("The host is invalid or not available");
      } else if (err.cause?.code == "ERR_SSL_WRONG_VERSION_NUMBER") {
        throw new Error(
          "This kind of URL is invalid. Please specify the protocol.",
        );
      }
    }

    // catch if server is not sending json
    if (
      err?.name === "SyntaxError" &&
      err?.message?.includes?.("Unexpected token")
    ) {
      // TODO: report this
      throw new Error(
        "The server probably down! Please contact your software provider",
      );
    }

    // filter out sensitive data from body that will be logged
    if (typeof body === "object") {
      if (body?.password) {
        body.password = "<REDACTED>";
      }
    }

    // TODO: catch json parse errors
    console.error("req() error:", {
      path,
      method,
      body,
      err: {
        name: err?.name,
        message: err?.message,
        cause: err?.cause,
      },
    });

    // TODO: report uncaught errors

    // throw error
    throw err;
  } finally {
    const requestTook = Date.now() - start;
    console.log(`REQUEST ${method} ${host}${path} TOOK`, requestTook, "ms");
  }
}

// fetch the signed in user using the auth cookie
export async function fetchUser(host: string): Promise<IUser> {
  const { json } = await req<IUser>(host, "GET", "/api/user");
  return json;
}

// log out the api session, expiring the auth cookie
export async function logout(host: string): Promise<Response> {
  const { res } = await req<ISuccessResponse>(host, "DELETE", "/api/auth");
  return res;
}

export async function addObservation(
  host: string,
  projectId: number,
): Promise<IObservationCreatedResponse> {
  const { json } = await req<IObservationCreatedResponse>(
    host,
    "POST",
    `/api/projects/${projectId}/observations`,
  );

  // const json = await res.json();
  if (typeof json["id"] !== "number") {
    console.error("Create observation response:", { json });
    throw new Error(
      "Api did not respond as expected when creating observation",
    );
  } else {
    return { id: json["id"] };
  }
}

export async function getProject(
  host: string,
  projectId: number,
): Promise<IGetProjectResponse> {
  const { json } = await req<IGetProjectResponse>(
    host,
    "GET",
    `/api/projects/${projectId}`,
  );

  // const json = await res.json();
  if (typeof json["id"] !== "number") {
    console.error("Fetch project response:", { json });
    throw new Error(
      "Api did not respond as expected when creating observation",
    );
  } else {
    return json;
  }
}

export async function deleteObservation(
  host: string,
  projectId: number,
  observationId: number,
) {
  const { res, json } = await req(
    host,
    "DELETE",
    `/api/projects/${projectId}/observations/${observationId}`,
  );
  if (res.status !== 200) {
    console.error("Unable to delete observation", { json });
    // TODO: report error
  }

  return json;
}

export function parseHostUrl(host: string): string {
  // ensure host is thruthy and a string
  if (!host || typeof host != "string") {
    throw new Error("Host parameter is required");
  }

  // if no scheme is set, default to https
  const hasProtocol = /^.+\:\/\//.test(host);
  if (!hasProtocol) {
    host = "https://" + host;
  }

  try {
    const parsedUrl = new URL(host);

    // only allow http and https
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error(
        "The host input field must begin with http:// or https://",
      );
    }
  } catch {
    throw new Error("Invalid host input value");
  }

  // return host
  return host;
}
