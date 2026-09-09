// Chain drafts in IndexedDB and the bridge to the repo (push / import).
//
// Draft = chain document + draft-only fields { draftId, updatedAt, repoPath, dirty }.
// The pushed file never contains the draft-only fields.

import { dbGetAll, dbPut, dbDelete, dbGet } from "../db.js";
import * as store from "../collections-store.js";
import { CHAIN_SUFFIX, fileBaseName } from "../postman.js";

export const SCHEMA_VERSION = 1;
const DRAFT_FIELDS = ["draftId", "updatedAt", "repoPath", "dirty"];

export const chainEvents = new EventTarget();
const emit = (name, detail) => chainEvents.dispatchEvent(new CustomEvent(name, { detail }));

export const newId = (prefix = "s") => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

export function newChain(name = "New chain") {
    return { schemaVersion: SCHEMA_VERSION, name, description: "", steps: [], dirty: true, updatedAt: Date.now() };
}

// request: { name?, method, url, headers[{name,value,isAuth}], body }   source: {collection, requestName, path} | null
export function newStep(request = {}, source = null) {
    return {
        id: newId(),
        label: request.name || (request.url ? shortUrl(request.url) : "New step"),
        labelAuto: !request.name,   // label follows the URL until the user edits it
        source,
        request: {
            method: (request.method || "GET").toUpperCase(),
            url: request.url || "",
            headers: (request.headers || []).filter(h => h.enabled !== false).map(h => ({ name: h.name, value: h.value, isAuth: !!h.isAuth })),
            body: request.body == null ? "" : String(request.body)
        },
        outputs: [],
        options: { continueOnError: false, delayMs: 0, verifyTls: true }
    };
}

// "/users/1" from "https://x/users/1" or "{{base}}/users/1"; falls back to the raw string.
export function shortUrl(url) {
    if (!url) return "";
    let s = String(url).replace(/\{\{[^}]+\}\}/g, "x");
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "http://" + s.replace(/^\/+/, "");
    try { const u = new URL(s); return u.pathname.length > 1 ? u.pathname : u.host; } catch (_) { return url; }
}

// Fill in anything an older or hand-written file lacks.
export function normalizeChain(raw) {
    const chain = { schemaVersion: SCHEMA_VERSION, name: "Unnamed chain", description: "", ...raw };
    chain.steps = (chain.steps || []).map(s => ({
        id: s.id || newId(),
        label: s.label || "",
        source: s.source || null,
        request: { method: "GET", url: "", headers: [], body: "", ...(s.request || {}) },
        outputs: (s.outputs || []).map(o => ({ name: o.name || "", source: o.source === "header" ? "header" : "body", path: o.path || "" })),
        options: { continueOnError: false, delayMs: 0, verifyTls: true, ...(s.options || {}) },
        ...Object.fromEntries(Object.entries(s).filter(([k]) => !["id", "label", "source", "request", "outputs", "options"].includes(k)))
    }));
    return chain;
}

export function stripDraftFields(chain) {
    const out = {};
    for (const [k, v] of Object.entries(chain)) if (!DRAFT_FIELDS.includes(k)) out[k] = v;
    return out;
}

// ---------- drafts ----------

export const listDrafts = () => dbGetAll("chainDrafts");
export const loadDraft = (id) => dbGet("chainDrafts", id);

export async function saveDraft(chain) {
    chain.updatedAt = Date.now();
    const copy = { ...chain };
    if (copy.draftId == null) delete copy.draftId;
    const id = await dbPut("chainDrafts", copy);
    chain.draftId = id;
    emit("drafts");
    return id;
}

export async function deleteDraft(id) {
    await dbDelete("chainDrafts", id);
    emit("drafts");
}

let saveTimer = null;
export function scheduleSave(chain, delay = 500) {
    chain.dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveDraft(chain).catch(err => console.error("chain autosave failed", err)), delay);
}

export function flushSave(chain) {
    clearTimeout(saveTimer);
    return saveDraft(chain);
}

// ---------- repo bridge ----------

// Chain files the collections store has pulled: [{ path, name, chain, version }]
export function repoChains() {
    return store.getFiles().filter(f => f.kind === "chain" && f.chain).map(f => ({ path: f.path, name: fileBaseName(f.path), chain: f.chain, version: f.version }));
}

// Import a pulled chain file as a draft (or refresh the draft that already tracks it).
export async function importChainFile(file) {
    const drafts = await listDrafts();
    const existing = drafts.find(d => d.repoPath === file.path);
    const chain = normalizeChain(file.chain);
    const draft = { ...chain, draftId: existing ? existing.draftId : undefined, repoPath: file.path, dirty: false };
    if (draft.draftId == null) delete draft.draftId;
    await saveDraft(draft);
    return draft;
}

// Headers flagged isAuth must be placeholders before the chain goes into a repo.
export function findLiteralSecrets(chain) {
    const hits = [];
    chain.steps.forEach((s, i) => {
        for (const h of s.request.headers || []) {
            if (h.isAuth && h.value && h.value.trim() !== "" && !/^\{\{.+\}\}$/.test(h.value.trim())) {
                hits.push(`step ${i + 1} (${s.label || s.request.url}): header ${h.name}`);
            }
        }
    });
    return hits;
}

export async function pushChain(chain, message) {
    if (!store.getRepo()) throw new Error("No repository selected. Pick one in Settings.");
    const secrets = findLiteralSecrets(chain);
    if (secrets.length) throw new Error(`Refusing to push literal auth values. Use {{variables}} for: ${secrets.join("; ")}`);
    const folder = chain.repoPath ? chain.repoPath.slice(0, chain.repoPath.lastIndexOf("/") + 1) : "/";
    const entry = store.putChainFile(chain.name, stripDraftFields(chain), folder);
    const result = await store.push(entry.path, message || `Update chain ${chain.name} via My Pal JSON`);
    chain.repoPath = entry.path;
    chain.dirty = false;
    await saveDraft(chain);
    return result;
}

export function suggestedFileName(chain) {
    return chain.name.trim().replace(/[\\/:*?"<>|]/g, "-") + CHAIN_SUFFIX;
}
