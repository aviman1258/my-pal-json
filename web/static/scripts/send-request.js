// Main-tab request state and the Send button.
//
// dataStore is the shared state other modules read:
//   requestData / responseData   text shown under the Request / Response sub-tabs
//   responseMeta                 { status_code, status_text, headers, elapsed_ms, effective_url } of the last send
//   currentRef                   { path, node } of the loaded collection request, or null for ad hoc
//   currentName                  display name of the loaded request
//   formDirty                    true once the form was edited after loading

import { readHeaders, setHeaders, DEFAULT_HEADERS } from "./headers-management.js";
import { resolveRequest } from "./variables.js";
import { activeScope } from "./environments.js";
import { toast, escapeHtml } from "./ui.js";

export const requestEvents = new EventTarget();
const emit = (name, detail) => requestEvents.dispatchEvent(new CustomEvent(name, { detail }));

export const dataStore = {
    requestData: "",
    responseData: "",
    responseMeta: null,
    currentRef: null,
    currentName: "",
    formDirty: false,

    // Snapshot of the form: { name, method, url, headers[{name,value,isAuth}], body }
    currentRequest() {
        return {
            name: this.currentName || "",
            method: document.getElementById("httpMethod").value,
            url: document.getElementById("apiUrl").value.trim(),
            headers: readHeaders(),
            body: this.requestData || "",
            bodyMode: (this.requestData || "").trim() === "" ? "none" : "raw"
        };
    },

    // Fill the form from a request snapshot. ref = { path, node } when it came from a collection.
    loadRequest(request, ref = null) {
        document.getElementById("apiUrl").value = request.url || "";
        const methodSel = document.getElementById("httpMethod");
        ensureMethodOption(methodSel, request.method || "GET");
        methodSel.value = (request.method || "GET").toUpperCase();

        document.getElementById("responseTab").classList.remove("active");
        document.getElementById("requestTab").classList.add("active");

        let bodyText = request.body == null ? "" : String(request.body);
        try { bodyText = JSON.stringify(JSON.parse(bodyText), null, 2); } catch (_) { /* keep raw */ }
        document.getElementById("inputJson").value = bodyText;
        this.requestData = bodyText;
        this.responseData = "";
        this.responseMeta = null;
        renderStatus(null);

        // A collection request keeps its own headers even when empty; only ad hoc loads fall back to defaults.
        const enabledHeaders = (request.headers || []).filter(h => h.enabled !== false);
        setHeaders(ref || enabledHeaders.length ? enabledHeaders : DEFAULT_HEADERS);

        this.currentRef = ref;
        this.currentName = request.name || "";
        this.formDirty = false;
        renderRequestName();
        emit("loaded", { request, ref });
    },

    clearRef() {
        this.currentRef = null;
        this.currentName = "";
        this.formDirty = false;
        renderRequestName();
    }
};

function ensureMethodOption(select, method) {
    method = method.toUpperCase();
    if (!Array.from(select.options).some(o => o.value === method)) {
        const opt = document.createElement("option");
        opt.value = method; opt.textContent = method;
        select.appendChild(opt);
    }
}

function renderRequestName() {
    const el = document.getElementById("requestName");
    if (!el) return;
    el.textContent = dataStore.currentName || "";
    el.title = dataStore.currentRef ? dataStore.currentRef.path : "";
    el.classList.toggle("dirty", dataStore.formDirty && !!dataStore.currentRef);
}

export function markFormDirty() {
    if (dataStore.currentRef && !dataStore.formDirty) {
        dataStore.formDirty = true;
        renderRequestName();
    }
}

// Headers grid -> plain object for the proxy. Auth values get the Bearer prefix.
export function collectHeaders(headers = readHeaders()) {
    const out = {};
    for (const h of headers) {
        if (!h.name) continue;
        if (h.isAuth && h.value && !/^bearer\s/i.test(h.value) && h.name.toLowerCase() === "authorization") {
            out[h.name] = `Bearer ${h.value}`;
        } else if (h.value !== "" || !h.isAuth) {
            out[h.name] = h.value;
        }
    }
    return out;
}

// ---------- response rendering ----------

export function renderStatus(meta, extra = "") {
    const el = document.getElementById("responseStatus");
    if (!el) return;
    if (!meta) { el.innerHTML = extra; return; }
    const code = meta.status_code;
    const cls = code >= 500 ? "code-err" : code >= 400 ? "code-warn" : "code-ok";
    const headers = meta.headers || {};
    const headerLines = Object.entries(headers).map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`).join("\n");
    el.innerHTML = `
        <span class="${cls}">${code} ${escapeHtml(meta.status_text || "")}</span>
        <span>${meta.elapsed_ms != null ? meta.elapsed_ms + " ms" : ""}</span>
        <details><summary>Headers (${Object.keys(headers).length})</summary><pre>${headerLines}</pre></details>
        ${extra}`;
}

export function formatContent(content) {
    if (content === null || content === undefined) return "";
    if (typeof content === "string") {
        try { return JSON.stringify(JSON.parse(content), null, 2); } catch (_) { return content; }
    }
    return JSON.stringify(content, null, 2);
}

// ---------- send ----------

// Send a request snapshot through the proxy. Returns the envelope from Flask.
export async function sendRequest(request, { verifyTls = true } = {}) {
    let body = null, rawBody;
    const text = (request.body || "").trim();
    if (text !== "") {
        try { body = JSON.parse(text); } catch (_) { rawBody = request.body; }
    }
    const res = await fetch("/proxy_request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            apiUrl: request.url,
            httpMethod: request.method,
            headers: collectHeaders(request.headers),
            body,
            rawBody,
            verifyTls
        })
    });
    const data = await res.json().catch(() => ({ error: `${res.status} ${res.statusText}` }));
    if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
    return data;
}

document.getElementById("sendBtn").addEventListener("click", async () => {
    const inputJsonElement = document.getElementById("inputJson");
    const sendBtn = document.getElementById("sendBtn");

    // Make sure the request text reflects what is on screen if the Request tab is active.
    if (document.getElementById("requestTab").classList.contains("active")) {
        dataStore.requestData = inputJsonElement.value;
    }

    const snapshot = dataStore.currentRequest();
    if (!snapshot.url) { toast("Enter an API endpoint first.", "warn"); return; }

    const scope = await activeScope();
    const { request: resolved, unresolved } = resolveRequest(snapshot, scope);
    const verifyTls = !(document.getElementById("skipTlsCheck") || {}).checked;

    sendBtn.disabled = true;
    renderStatus(null, `<span class="msg-muted">Sending…</span>`);
    try {
        const result = await sendRequest(resolved, { verifyTls });
        dataStore.responseMeta = result;
        dataStore.responseData = formatContent(result.content);

        inputJsonElement.value = dataStore.responseData;
        document.getElementById("requestTab").classList.remove("active");
        document.getElementById("responseTab").classList.add("active");

        const warn = unresolved.length
            ? `<span class="code-warn" title="No value in the active environment">unresolved: ${unresolved.map(escapeHtml).join(", ")}</span>` : "";
        const rewritten = result.effective_url && result.requested_url && result.effective_url.split("?")[0] !== result.requested_url.split("?")[0]
            ? `<span class="msg-muted" title="localhost was rewritten for the container">→ ${escapeHtml(new URL(result.effective_url).host)}</span>` : "";
        renderStatus(result, warn + rewritten);
        emit("sent", { request: resolved, result });
    } catch (err) {
        renderStatus(null, `<span class="code-err">${escapeHtml(err.message)}</span>`);
        toast(err.message, "error", 6000);
    } finally {
        sendBtn.disabled = false;
    }
});

// Track edits so the loaded-request label can show a dirty marker.
["apiUrl", "httpMethod", "inputJson"].forEach(id => {
    document.getElementById(id).addEventListener("input", markFormDirty);
});
document.getElementById("headersGrid").addEventListener("input", markFormDirty);
document.getElementById("headersGrid").addEventListener("change", markFormDirty);
