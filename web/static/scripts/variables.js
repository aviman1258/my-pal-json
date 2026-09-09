// {{variable}} substitution and JSON-path lookup. Shared by the main tab and the chain runner.

const VAR_RE = /\{\{\s*([A-Za-z0-9_.\-$]+)\s*\}\}/g;

// Names of every {{var}} in a string, in order, de-duplicated.
export function findVars(str) {
    const names = [];
    if (typeof str !== "string") return names;
    for (const m of str.matchAll(VAR_RE)) {
        if (!names.includes(m[1])) names.push(m[1]);
    }
    return names;
}

// Replace {{name}} with scope[name]. Unknown names are left as-is and reported.
export function resolveVars(template, scope = {}) {
    const unresolved = [];
    if (typeof template !== "string") return { text: template, unresolved };
    const text = template.replace(VAR_RE, (whole, name) => {
        if (Object.prototype.hasOwnProperty.call(scope, name) && scope[name] !== undefined && scope[name] !== null) {
            return String(scope[name]);
        }
        if (!unresolved.includes(name)) unresolved.push(name);
        return whole;
    });
    return { text, unresolved };
}

// Resolve url, header names/values and body of a request snapshot. Returns a new object.
export function resolveRequest(request, scope = {}) {
    const unresolved = new Set();
    const take = (s) => {
        const r = resolveVars(s, scope);
        r.unresolved.forEach(n => unresolved.add(n));
        return r.text;
    };
    const resolved = {
        ...request,
        url: take(request.url || ""),
        headers: (request.headers || []).map(h => ({ ...h, name: take(h.name), value: take(h.value) })),
        body: request.body == null ? request.body : take(request.body)
    };
    return { request: resolved, unresolved: Array.from(unresolved) };
}

// Merge environments/outputs. Later arguments win.
export function buildScope(...layers) {
    return Object.assign({}, ...layers.filter(Boolean));
}

// Tiny JSON path resolver: $.a.b[0].c, a.b[0], $[0].id, ["key with spaces"].
// Returns undefined when any hop is missing.
export function getPath(obj, path) {
    if (path == null) return undefined;
    let p = String(path).trim();
    if (p.startsWith("$")) p = p.slice(1);
    const tokens = [];
    const re = /\.?([^.[\]]+)|\[(\d+)\]|\["((?:[^"\\]|\\.)*)"\]|\['((?:[^'\\]|\\.)*)'\]/g;
    let m;
    while ((m = re.exec(p)) !== null) {
        if (m[1] !== undefined) tokens.push(m[1]);
        else if (m[2] !== undefined) tokens.push(Number(m[2]));
        else if (m[3] !== undefined) tokens.push(m[3].replace(/\\(.)/g, "$1"));
        else if (m[4] !== undefined) tokens.push(m[4].replace(/\\(.)/g, "$1"));
    }
    let cur = obj;
    for (const t of tokens) {
        if (cur === null || cur === undefined) return undefined;
        cur = cur[t];
    }
    return cur;
}

// Value → string suitable for textual substitution. Objects/arrays are JSON.
export function stringifyValue(v) {
    if (v === undefined) return undefined;
    if (v === null) return "null";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
}
