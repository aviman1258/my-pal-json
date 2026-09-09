// In-memory cache of the files pulled from the active repo, plus dirty tracking and push.
//
// files: Map<path, entry>
//   entry = { path, kind: "collection"|"chain", version, dirty, collection?, chain?, error? }
//
// Events on `storeEvents`:
//   "repo"    active repo changed (detail: repo record or null)
//   "pulled"  a pull finished
//   "changed" any file added/removed/marked dirty/pushed

import { dbGetAll, dbPut, dbDelete, getSetting, setSetting } from "./db.js";
import * as repoApi from "./repo-api.js";
import { parseCollection, serializeCollection, newCollection, COLLECTION_SUFFIX, CHAIN_SUFFIX } from "./postman.js";

export const storeEvents = new EventTarget();
const emit = (name, detail) => storeEvents.dispatchEvent(new CustomEvent(name, { detail }));

const state = {
    repo: null,          // { url, token, branch, provider, label, lastPulled }
    files: new Map(),
    pulling: false
};

export const getRepo = () => state.repo;
export const getFiles = () => Array.from(state.files.values());
export const getFile = (path) => state.files.get(path) || null;
export const dirtyFiles = () => getFiles().filter(f => f.dirty);
export const isPulling = () => state.pulling;

// ---------- repos (IndexedDB) ----------

export const listRepos = () => dbGetAll("repos");

export async function saveRepo(repo) {
    await dbPut("repos", repo);
    if (state.repo && state.repo.url === repo.url) state.repo = repo;
    emit("repos");
}

export async function deleteRepo(url) {
    await dbDelete("repos", url);
    if (state.repo && state.repo.url === url) await setActiveRepo(null);
    emit("repos");
}

export async function restoreActiveRepo() {
    const url = await getSetting("activeRepoUrl", null);
    if (!url) return null;
    const repos = await listRepos();
    const repo = repos.find(r => r.url === url) || null;
    state.repo = repo;
    emit("repo", repo);
    return repo;
}

export async function setActiveRepo(repo) {
    state.repo = repo;
    state.files.clear();
    await setSetting("activeRepoUrl", repo ? repo.url : null);
    emit("repo", repo);
    emit("changed");
}

export async function setBranch(branch) {
    if (!state.repo) return;
    state.repo = { ...state.repo, branch };
    await dbPut("repos", state.repo);
    state.files.clear();
    emit("repo", state.repo);
    emit("changed");
}

// ---------- pull ----------

function kindOf(path) {
    if (path.endsWith(COLLECTION_SUFFIX)) return "collection";
    if (path.endsWith(CHAIN_SUFFIX)) return "chain";
    return null;
}

// Lists the repo root plus one folder level, fetches every collection/chain file.
export async function pull() {
    if (!state.repo) throw new Error("No repository selected");
    state.pulling = true;
    emit("changed");
    try {
        const root = await repoApi.getTree(state.repo, "/", false);
        const candidates = [];
        const subdirs = [];
        for (const it of root) {
            const p = normalizePath(it.path);
            if (it.type === "dir" || it.type === "folder" || it.isFolder) { if (!p.startsWith("/.")) subdirs.push(p); }
            else if (kindOf(p)) candidates.push({ path: p, version: it.version });
        }
        for (const d of subdirs) {
            try {
                const items = await repoApi.getTree(state.repo, d, false);
                for (const it of items) {
                    const p = normalizePath(it.path);
                    if ((it.type === "file" || it.type === "blob") && kindOf(p)) candidates.push({ path: p, version: it.version });
                }
            } catch (_) { /* unreadable subfolder: skip */ }
        }

        const next = new Map();
        for (const c of candidates) {
            const prev = state.files.get(c.path);
            // Keep unpushed local edits instead of clobbering them.
            if (prev && prev.dirty) { next.set(c.path, { ...prev, remoteVersion: c.version }); continue; }
            try {
                const file = await repoApi.getFile(state.repo, c.path);
                next.set(c.path, buildEntry(c.path, file.content, file.version));
            } catch (err) {
                next.set(c.path, { path: c.path, kind: kindOf(c.path), version: c.version, dirty: false, error: err.message });
            }
        }
        // Keep brand-new local files that don't exist remotely yet.
        for (const [p, e] of state.files) if (e.dirty && e.version == null && !next.has(p)) next.set(p, e);

        state.files = next;
        state.repo = { ...state.repo, lastPulled: Date.now() };
        await dbPut("repos", state.repo);
        emit("pulled");
        emit("changed");
        return getFiles();
    } finally {
        state.pulling = false;
        emit("changed");
    }
}

function normalizePath(p) {
    p = String(p || "");
    return p.startsWith("/") ? p : "/" + p;
}

function buildEntry(path, content, version) {
    const kind = kindOf(path);
    const entry = { path, kind, version, dirty: false };
    try {
        if (kind === "collection") entry.collection = parseCollection(content, path);
        else if (kind === "chain") entry.chain = JSON.parse(content);
    } catch (err) {
        entry.error = `Could not parse: ${err.message}`;
    }
    return entry;
}

// ---------- local edits ----------

export function markDirty(path) {
    const e = state.files.get(path);
    if (e) { e.dirty = true; emit("changed"); }
}

export function createCollectionFile(name, folder = "/") {
    const clean = name.trim().replace(/[\\/:*?"<>|]/g, "-");
    const path = (folder.endsWith("/") ? folder : folder + "/") + clean + COLLECTION_SUFFIX;
    if (state.files.has(path)) throw new Error(`${path} already exists`);
    const entry = buildEntry(path, JSON.stringify(newCollection(clean)), null);
    entry.dirty = true;
    state.files.set(path, entry);
    emit("changed");
    return entry;
}

export function putChainFile(name, chainJson, folder = "/") {
    const clean = name.trim().replace(/[\\/:*?"<>|]/g, "-");
    const path = (folder.endsWith("/") ? folder : folder + "/") + clean + CHAIN_SUFFIX;
    const prev = state.files.get(path);
    const entry = { path, kind: "chain", version: prev ? prev.version : null, dirty: true, chain: chainJson };
    state.files.set(path, entry);
    emit("changed");
    return entry;
}

export function serializeEntry(entry) {
    if (entry.kind === "collection") return serializeCollection(entry.collection);
    return JSON.stringify(entry.chain, null, 2);
}

// ---------- push ----------

// Push one file. Throws RepoApiError(409) when the server copy moved.
export async function push(path, message) {
    const e = state.files.get(path);
    if (!e) throw new Error(`Unknown file ${path}`);
    const content = serializeEntry(e);
    const result = await repoApi.putFile(state.repo, path, content, message, e.version);
    e.version = result.version || e.version;
    e.dirty = false;
    delete e.remoteVersion;
    emit("changed");
    return result;
}

// Remove a file locally and, if it exists remotely, on the server too.
export async function removeFile(path, message) {
    const e = state.files.get(path);
    if (!e) return;
    if (e.version != null) await repoApi.deleteFile(state.repo, path, message, e.version);
    state.files.delete(path);
    emit("changed");
}

// Drop local changes to one file and re-read it from the server.
export async function revert(path) {
    const e = state.files.get(path);
    if (!e) return;
    if (e.version == null && e.remoteVersion == null) { state.files.delete(path); emit("changed"); return; }
    const file = await repoApi.getFile(state.repo, path);
    state.files.set(path, buildEntry(path, file.content, file.version));
    emit("changed");
}
