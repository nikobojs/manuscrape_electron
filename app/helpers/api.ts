export async function fetchUser(
    host: string,
    token: string
): Promise<IUser> {
    const res = await fetch(host + '/api/user', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/javascript',
            'Authentication': token,
        },
        credentials: 'include'
    })

    const json = await res.json();

    if (res.status !== 200) {
        const msg =  json?.statusMessage ?? 'Unknown error'
        throw new Error(msg)
    }

    return json;
}


export async function tryLogin(
    host: string,
    email: string,
    password: string
): Promise<ILoginOKResponse> {
    const res = await fetch(host + '/api/auth', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: {
          'Content-Type': 'application/javascript',
        },
        credentials: 'include'
    })

    const json = await res.json();

    if (res.status !== 200) {
        const msg =  json?.statusMessage ?? 'Unknown error'
        throw new Error(msg)
    }

    return json;
}


export async function logout(
    host: string,
    token: string
): Promise<void> {
    await fetch(host + '/api/auth', {
        method: 'DELETE',
        headers: {
            'Authentication': token,
        },
    });
}


export async function renewCookie(
    host: string,
    token: string
): Promise<Response> {
    return fetch(host + '/api/token_auth', {
        credentials: 'include',
        method: 'POST',
        headers: {
            'Authentication': token,
        },
        body: JSON.stringify({ token }),
    });
}


export async function addObservationDraft(
    host: string,
    token: string,
    projectId: number,
): Promise<{ id: number }> {
    const res = await fetch(host + `/api/projects/${projectId}/observation_drafts`, {
        credentials: 'include',
        method: 'POST',
        headers: {
            'Authentication': token,
        },
    });

    const json = await res.json();
    if (typeof json['id'] !== 'number') {
        console.error('Create observation response:', { json })
        throw new Error('Api did not respond as expected when adding observation draft');
    } else {
        return { id: json['id'] };
    }
}