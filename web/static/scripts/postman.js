// Postman Collection v2.1 <-> app request mapping.
//
// A parsed collection keeps the original JSON in `_raw` and builds a tree of nodes that
// *reference* items inside `_raw`, so edits patch the original and unknown fields
// (events/scripts, auth blocks, descriptions, responses, ids) round-trip untouched.
//
// App request shape (shared with the chain tab):
//   { name, method, url, headers: [{ name, value, isAuth, enabled }], body: string|null, bodyMode: "raw"|"none"|"other" }

export const POSTMAN_SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";
export const COLLECTION_SUFFIX = ".postman_collection.json";
export const CHAIN_SUFFIX = ".mypaljson_chain.json";

// Mirrors SECRET_KEYS in the rentaltools-api repo's scripts/scan-secrets.py.
export const SECRET_KEY_RE = /^(x-)?(api[_-]?key|apikey|client[_-]?secret|clientsecret|secret|password|passwd|pwd|token|auth[_-]?token|authtoken|access[_-]?key|private[_-]?key|clientid|client[_-]?id|x-xsrf-token|authorization|bearer|refresh[_-]?token)$/i;

let nodeSeq = 0;
const nextNodeId = () => `n${++nodeSeq}`;

// ---------- parse ----------

export function parseCollection(json, filePath) {
    const raw = typeof json === "string" ? JSON.parse(json) : json;
    if (!raw || !Array.isArray(raw.item)) throw new Error("Not a Postman collection (missing item[])");
    const root = {
        id: nextNodeId(), kind: "collection", name: (raw.info && raw.info.name) || fileBaseName(filePath),
        item: raw, parent: null, children: []
    };
    root.children = buildChildren(raw.item, root);
    return { filePath, name: root.name, _raw: raw, root };
}

function buildChildren(items, parent) {
    return items.map(item => {
        if (Array.isArray(item.item)) {
            const node = { id: nextNodeId(), kind: "folder", name: item.name || "(folder)", item, parent, children: [] };
            node.children = buildChildren(item.item, node);
            return node;
        }
        return { id: nextNodeId(), kind: "request", name: item.name || "(request)", item, parent, children: null };
    });
}

export function fileBaseName(filePath) {
    const base = (filePath || "").split("/").pop();
    return base.replace(COLLECTION_SUFFIX, "").replace(CHAIN_SUFFIX, "").replace(/\.json$/, "");
}

// Walk up folders/collection for an inherited auth block.
export function inheritedAuth(node) {
    let n = node.parent;
    while (n) {
        const auth = n.item && (n.kind === "collection" ? n.item.auth : n.item.auth);
        if (auth && auth.type && auth.type !== "noauth") return auth;
        n = n.parent;
    }
    return null;
}

export function* walkRequests(node) {
    if (!node) return;
    if (node.kind === "request") { yield node; return; }
    for (const c of node.children || []) yield* walkRequests(c);
}

// "TU / Folder / Request" style path for labels.
export function nodePath(node) {
    const parts = [];
    let n = node;
    while (n) { parts.unshift(n.name); n = n.parent; }
    return parts;
}

// ---------- item -> app request ----------

export function itemToRequest(item, inherited = null) {
    const req = item.request || {};
    const method = (typeof req === "string" ? "GET" : (req.method || "GET")).toUpperCase();
    const url = typeof req === "string" ? req : urlToString(req.url);

    const headers = (req.header || []).map(h => ({
        name: h.key || "",
        value: h.value == null ? "" : String(h.value),
        isAuth: (h.key || "").toLowerCase() === "authorization",
        enabled: !h.disabled
    }));

    const auth = (req.auth && req.auth.type && req.auth.type !== "noauth") ? req.auth : inherited;
    if (auth && auth.type === "bearer" && !headers.some(h => h.name.toLowerCase() === "authorization")) {
        const tokenEntry = Array.isArray(auth.bearer) ? auth.bearer.find(b => b.key === "token") : null;
        const tokenValue = tokenEntry ? String(tokenEntry.value || "") : "";
        headers.push({ name: "Authorization", value: stripBearer(tokenValue), isAuth: true, enabled: true, synthetic: true });
    }

    let body = null, bodyMode = "none";
    if (req.body && req.body.mode) {
        if (req.body.mode === "raw") { body = req.body.raw == null ? "" : String(req.body.raw); bodyMode = "raw"; }
        else { body = JSON.stringify(req.body, null, 2); bodyMode = "other"; }
    }

    return { name: item.name || "", method, url, headers, body, bodyMode };
}

function stripBearer(v) {
    return v.replace(/^Bearer\s+/i, "");
}

export function urlToString(url) {
    if (!url) return "";
    if (typeof url === "string") return url;
    if (url.raw) return url.raw;
    // Rebuild from parts when raw is missing.
    const proto = url.protocol ? `${url.protocol}://` : "";
    const host = Array.isArray(url.host) ? url.host.join(".") : (url.host || "");
    const port = url.port ? `:${url.port}` : "";
    const path = Array.isArray(url.path) ? "/" + url.path.join("/") : (url.path || "");
    const query = Array.isArray(url.query) && url.query.length
        ? "?" + url.query.filter(q => !q.disabled).map(q => `${q.key}=${q.value == null ? "" : q.value}`).join("&") : "";
    return `${proto}${host}${port}${path}${query}`;
}

// ---------- app request -> item ----------

// Patch an existing item (or build a new one) from an app request. Unknown fields survive.
export function requestToItem(request, existingItem = null) {
    const item = existingItem ? structuredClone(existingItem) : newRequestItem(request.name);
    if (typeof item.request === "string") item.request = { method: "GET", url: item.request, header: [] };
    item.name = request.name || item.name;
    item.request.method = (request.method || "GET").toUpperCase();

    // URL: keep the object form if it existed, but drop derived parts so Postman re-derives from raw.
    if (item.request.url && typeof item.request.url === "object") {
        const keep = { ...item.request.url, raw: request.url || "" };
        delete keep.host; delete keep.path; delete keep.query; delete keep.protocol; delete keep.port;
        item.request.url = keep;
    } else {
        item.request.url = { raw: request.url || "" };
    }

    // Headers: rebuild from the app list, preserving description/type of matched keys.
    const oldHeaders = Array.isArray(item.request.header) ? item.request.header : [];
    item.request.header = (request.headers || [])
        .filter(h => h.name && h.name.trim() !== "" && !h.synthetic)
        .map(h => {
            const prev = oldHeaders.find(o => (o.key || "").toLowerCase() === h.name.toLowerCase()) || {};
            const out = { ...prev, key: h.name, value: h.value == null ? "" : h.value, type: prev.type || "text" };
            if (h.enabled === false) out.disabled = true; else delete out.disabled;
            return out;
        });

    // Body
    if (request.bodyMode === "raw" || (request.bodyMode == null && request.body != null)) {
        const prevBody = item.request.body && item.request.body.mode === "raw" ? item.request.body : null;
        item.request.body = prevBody
            ? { ...prevBody, raw: request.body || "" }
            : { mode: "raw", raw: request.body || "", options: { raw: { language: "json" } } };
    } else if (request.bodyMode === "none" || (request.body == null && request.bodyMode == null)) {
        if (item.request.body && item.request.body.mode === "raw") delete item.request.body;
    }
    // bodyMode "other": leave the original body untouched.
    return item;
}

export function newRequestItem(name = "New Request") {
    return {
        name,
        request: { method: "GET", header: [], url: { raw: "" } },
        response: []
    };
}

export function newFolderItem(name = "New Folder") {
    return { name, item: [] };
}

export function newCollection(name) {
    return { info: { name, schema: POSTMAN_SCHEMA }, item: [] };
}

// ---------- secret scrubbing (write path) ----------

// Replace literal secret-looking values with {{placeholders}}. Returns a list of what changed.
// `nameFor(key, value, where)` picks the placeholder name; the default derives it from the key.
// Pass an allocator from secret-scrub.js to also move the values into an environment.
export function scrubSecrets(item, appHeaders = null, nameFor = (key) => toCamel(key), where = "") {
    const changes = [];
    const req = item.request;
    if (!req || typeof req !== "object") return changes;
    const ph = (key, value, spot) => `{{${nameFor(key, value, where ? `${where} ${spot}` : spot)}}}`;

    const isAuthKey = (key) => {
        if (SECRET_KEY_RE.test(key)) return true;
        if (appHeaders) {
            const h = appHeaders.find(x => x.name.toLowerCase() === key.toLowerCase());
            return !!(h && h.isAuth);
        }
        return false;
    };

    for (const h of req.header || []) {
        const v = h.value == null ? "" : String(h.value);
        if (isAuthKey(h.key || "") && v.trim() !== "" && !isPlaceholder(v)) {
            const to = ph(h.key, v, `header ${h.key}`);
            changes.push({ where: `header ${h.key}`, from: v, to });
            h.value = to;
        }
    }

    if (req.body && req.body.mode === "raw" && typeof req.body.raw === "string") {
        const kv = /(["'])([A-Za-z_][A-Za-z0-9_-]*)\1\s*:\s*(["'])((?:(?!\3)[^\\]|\\.)+?)\3/g;
        req.body.raw = req.body.raw.replace(kv, (whole, q1, key, q3, val) => {
            if (SECRET_KEY_RE.test(key) && !isPlaceholder(val)) {
                const to = ph(key, val, `body ${key}`);
                changes.push({ where: `body ${key}`, from: val, to });
                return `${q1}${key}${q1}: ${q3}${to}${q3}`;
            }
            return whole;
        });
    }

    if (Array.isArray(req.url && req.url.query)) {
        for (const q of req.url.query) {
            const v = q.value == null ? "" : String(q.value);
            if (SECRET_KEY_RE.test(q.key || "") && v.trim() !== "" && !isPlaceholder(v)) {
                const to = ph(q.key, v, `query ${q.key}`);
                changes.push({ where: `query ${q.key}`, from: v, to });
                q.value = to;
            }
        }
    }
    return changes;
}

export function isPlaceholder(v) {
    const s = String(v).trim();
    return s === "" || s.startsWith("{{") || s.startsWith("<") || ["null", "true", "false"].includes(s.toLowerCase());
}

// "x-api-key" -> apiKey, "client_secret" -> clientSecret, "Authorization" -> authorization,
// "ApiKey" / "apiKey" -> apiKey (an existing camelCase key keeps its inner capitals).
export function toCamel(key) {
    const parts = String(key).replace(/^x-/i, "").split(/[^A-Za-z0-9]+/).filter(Boolean);
    if (!parts.length) return "secret";
    if (parts.length === 1) {
        const p = parts[0];
        const mixed = /[a-z]/.test(p) && /[A-Z]/.test(p.slice(1));
        return mixed ? p[0].toLowerCase() + p.slice(1) : p.toLowerCase();
    }
    return parts.map((p, i) => i === 0 ? p.toLowerCase() : p[0].toUpperCase() + p.slice(1).toLowerCase()).join("");
}

// ---------- tree operations (mutate _raw through node references) ----------

function containerArray(node) {
    return node.kind === "collection" ? node.item.item : node.item.item;
}

export function addRequest(collection, parentNode, request) {
    const item = requestToItem(request, null);
    containerArray(parentNode).push(item);
    const node = { id: nextNodeId(), kind: "request", name: item.name, item, parent: parentNode, children: null };
    parentNode.children.push(node);
    return node;
}

export function addFolder(collection, parentNode, name) {
    const item = newFolderItem(name);
    containerArray(parentNode).push(item);
    const node = { id: nextNodeId(), kind: "folder", name, item, parent: parentNode, children: [] };
    parentNode.children.push(node);
    return node;
}

export function renameNode(node, name) {
    node.name = name;
    if (node.kind === "collection") { node.item.info = node.item.info || {}; node.item.info.name = name; }
    else node.item.name = name;
}

export function deleteNode(node) {
    if (!node.parent) throw new Error("Cannot delete the collection root here");
    const arr = containerArray(node.parent);
    const i = arr.indexOf(node.item);
    if (i >= 0) arr.splice(i, 1);
    const j = node.parent.children.indexOf(node);
    if (j >= 0) node.parent.children.splice(j, 1);
}

export function duplicateNode(node) {
    if (!node.parent) throw new Error("Cannot duplicate the collection root");
    const copy = structuredClone(node.item);
    delete copy.id; delete copy._postman_id;
    copy.name = `${node.name} copy`;
    const arr = containerArray(node.parent);
    arr.splice(arr.indexOf(node.item) + 1, 0, copy);
    const newNode = node.kind === "folder"
        ? { id: nextNodeId(), kind: "folder", name: copy.name, item: copy, parent: node.parent, children: [] }
        : { id: nextNodeId(), kind: "request", name: copy.name, item: copy, parent: node.parent, children: null };
    if (node.kind === "folder") newNode.children = buildChildren(copy.item, newNode);
    node.parent.children.splice(node.parent.children.indexOf(node) + 1, 0, newNode);
    return newNode;
}

// Postman exports with tab indentation; matching it keeps diffs small.
export function serializeCollection(collection) {
    return JSON.stringify(collection._raw, null, "\t");
}
