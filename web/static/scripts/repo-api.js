// Client for the Flask /repo/* routes. The PAT travels in the X-Repo-Token header
// to localhost only; Flask forwards it to Azure DevOps or GitHub and never stores it.
//
// `repo` objects come from the IndexedDB "repos" store: { url, token, branch, provider, label }.

export class RepoApiError extends Error {
    constructor(status, message) {
        super(message);
        this.name = "RepoApiError";
        this.status = status;
    }
}

function qs(repo, extra = {}) {
    const params = new URLSearchParams({ repo: repo.url });
    if (repo.branch) params.set("branch", repo.branch);
    for (const [k, v] of Object.entries(extra)) {
        if (v !== undefined && v !== null) params.set(k, String(v));
    }
    return params.toString();
}

// repo.auth: "pat" (default, token sent from the browser), "azcli" or "gcm" (Flask gets the token
// from the Azure CLI / Git Credential Manager on this machine; nothing is sent from the browser).
async function call(repo, method, path, body) {
    if (!repo || !repo.url) throw new RepoApiError(400, "No repository selected.");
    const auth = repo.auth || "pat";
    if (auth === "pat" && !repo.token) throw new RepoApiError(401, "No token saved for this repository. Add one in Settings.");
    const res = await fetch(path, {
        method,
        headers: {
            "X-Repo-Auth": auth,
            ...(auth === "pat" ? { "X-Repo-Token": repo.token } : {}),
            ...(body !== undefined ? { "Content-Type": "application/json" } : {})
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = { error: text }; }
    if (!res.ok) {
        const msg = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`;
        throw new RepoApiError(res.status, msg);
    }
    return data;
}

// → { in_container, pat: {available}, msal: {available, account}, azcli: {available, account}, gcm: {available} }
export async function authSources() {
    const res = await fetch("/repo/auth-sources");
    return res.ok ? res.json() : { pat: { available: true }, msal: { available: false }, azcli: { available: false }, gcm: { available: false } };
}

// Microsoft browser sign-in (auth code + PKCE handled by Flask). Opens a popup; resolves with the account.
export async function msalSignIn() {
    const res = await fetch("/repo/auth/login");
    const data = await res.json();
    if (!res.ok) throw new RepoApiError(res.status, data.error || "Could not start sign-in");
    const popup = window.open(data.url, "mpj-signin", "width=560,height=720,menubar=no,toolbar=no");
    if (!popup) throw new RepoApiError(400, "The sign-in popup was blocked. Allow popups for this site and try again.");
    const started = Date.now();
    while (Date.now() - started < 5 * 60 * 1000) {
        await new Promise(r => setTimeout(r, 1500));
        const status = await (await fetch("/repo/auth/status")).json();
        if (status.account) { try { popup.close(); } catch (_) { /* cross-origin */ } return status.account; }
        if (popup.closed) {
            const again = await (await fetch("/repo/auth/status")).json();
            if (again.account) return again.account;
            throw new RepoApiError(401, "Sign-in window closed before finishing.");
        }
    }
    throw new RepoApiError(408, "Sign-in timed out.");
}

export async function msalStatus() {
    return (await fetch("/repo/auth/status")).json();
}

export async function msalSignOut() {
    await fetch("/repo/auth/logout", { method: "POST" });
}

// → { provider, name, default_branch, branches }
export function ping(repo) {
    return call(repo, "GET", `/repo/ping?${qs(repo)}`);
}

// → [{ path, type: "file"|"dir", version }]
export async function getTree(repo, path = "/", recursive = false) {
    const data = await call(repo, "GET", `/repo/tree?${qs(repo, { path, recursive: recursive ? 1 : 0 })}`);
    return Array.isArray(data) ? data : (data.items || data.value || []);
}

// → { content, version }
export function getFile(repo, path) {
    return call(repo, "GET", `/repo/file?${qs(repo, { path })}`);
}

// baseVersion null/undefined = create. → { version, commit }
export function putFile(repo, path, content, message, baseVersion = null) {
    return call(repo, "PUT", `/repo/file?${qs(repo, { path })}`, {
        content, message, base_version: baseVersion
    });
}

export function deleteFile(repo, path, message, baseVersion) {
    return call(repo, "DELETE", `/repo/file?${qs(repo, { path })}`, {
        message, base_version: baseVersion
    });
}

// Client-side mirror of the server's URL parser, for labels and validation before saving.
export function describeRepoUrl(url) {
    try {
        const u = new URL(url.trim());
        let m;
        if (u.hostname === "dev.azure.com" && (m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/_git\/([^/]+)\/?$/))) {
            return { provider: "ado", label: `${decodeURIComponent(m[2])} / ${decodeURIComponent(m[3])}`, name: decodeURIComponent(m[3]) };
        }
        if (u.hostname.endsWith(".visualstudio.com") && (m = u.pathname.match(/^\/([^/]+)\/_git\/([^/]+)\/?$/))) {
            return { provider: "ado", label: `${decodeURIComponent(m[1])} / ${decodeURIComponent(m[2])}`, name: decodeURIComponent(m[2]) };
        }
        if (u.hostname === "github.com" && (m = u.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/))) {
            return { provider: "github", label: `${m[1]} / ${m[2]}`, name: m[2] };
        }
    } catch (_) { /* fall through */ }
    return null;
}
