// Chain tab UI: chain picker, run bar, step cards, click-to-pick outputs, drafts and push.

import { toast, showContextMenu, escapeHtml } from "../ui.js";
import { getSetting, setSetting } from "../db.js";
import { createHeaderRow, readHeaders } from "../headers-management.js";
import { makeSortable } from "../drag-reorder.js";
import { renderJsonTree } from "../json-tree-view.js";
import { activeScope, getActiveEnv, envEvents } from "../environments.js";
import { dataStore, sendRequest, formatContent } from "../send-request.js";
import { openCollectionPicker } from "../collection-browser.js";
import { openSettings } from "../settings-panel.js";
import * as store from "../collections-store.js";
import { showView } from "../view-switch.js";
import {
    newChain, newStep, normalizeChain, listDrafts, loadDraft, saveDraft, deleteDraft, scheduleSave, flushSave,
    repoChains, importChainFile, pushChain, chainEvents, shortUrl
} from "./chain-store.js";
import { runChain, staticUnresolved, usesOfOutput, renameReferences } from "./chain-runner.js";
import { getPath, stringifyValue } from "../variables.js";

const state = {
    chain: null,
    results: new Map(),      // stepId -> result
    lastOutputs: {},         // outputs captured by the last run, for "run from here"
    running: false,
    abort: null,
    picking: null,           // { stepId, source: "body"|"header" }
    expanded: new Set(),
    envScope: {}
};

const $ = (id) => document.getElementById(id);
const stepsEl = () => $("chainSteps");

// ---------- chain selection ----------

async function refreshChainSelect() {
    const sel = $("chainSelect");
    const drafts = await listDrafts();
    const tracked = new Set(drafts.map(d => d.repoPath).filter(Boolean));
    const current = state.chain && state.chain.draftId != null ? `draft:${state.chain.draftId}` : "";
    sel.innerHTML = "";
    sel.appendChild(new Option(drafts.length ? "Choose a chain…" : "No chains yet", ""));
    for (const d of drafts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))) {
        sel.appendChild(new Option(`${d.name}${d.dirty ? " •" : ""}${d.repoPath ? "" : "  (local)"}`, `draft:${d.draftId}`));
    }
    const remote = repoChains().filter(r => !tracked.has(r.path));
    if (remote.length) {
        const grp = document.createElement("optgroup");
        grp.label = "In repository (not imported)";
        for (const r of remote) grp.appendChild(new Option(r.name, `repo:${r.path}`));
        sel.appendChild(grp);
    }
    sel.value = current;
    if (sel.value !== current) sel.value = "";
}

async function selectChainValue(value) {
    if (!value) return;
    if (state.chain) await flushSave(state.chain).catch(() => {});
    if (value.startsWith("draft:")) {
        const d = await loadDraft(Number(value.slice(6)));
        if (d) setChain(normalizeChain(d));
    } else if (value.startsWith("repo:")) {
        const file = store.getFile(value.slice(5));
        if (file) setChain(await importChainFile(file));
    }
}

function setChain(chain) {
    state.chain = chain;
    state.results = new Map();
    state.lastOutputs = {};
    state.picking = null;
    if (chain && chain.draftId != null) setSetting("lastChainDraftId", chain.draftId);
    render();
    refreshChainSelect();
}

async function createChain() {
    const name = prompt("Chain name:", "New chain");
    if (!name) return;
    const chain = newChain(name.trim());
    await saveDraft(chain);
    setChain(chain);
}

async function deleteCurrentChain() {
    const c = state.chain;
    if (!c) return;
    const msg = c.repoPath
        ? `Remove the local draft of "${c.name}"? The file stays in the repository.`
        : `Delete chain "${c.name}"? It only exists in this browser.`;
    if (!confirm(msg)) return;
    if (c.draftId != null) await deleteDraft(c.draftId);
    state.chain = null;
    render();
    refreshChainSelect();
}

async function pushCurrentChain() {
    const c = state.chain;
    if (!c) return;
    if (!store.getRepo()) { toast("Pick a repository first (Settings).", "warn"); return; }
    const message = prompt("Commit message:", `${c.repoPath ? "Update" : "Add"} chain ${c.name} via My Pal JSON`);
    if (!message) return;
    try {
        await pushChain(c, message);
        toast(`Pushed ${c.repoPath}.`);
        render();
        refreshChainSelect();
    } catch (err) {
        toast(err.message, "error", 8000);
    }
}

function touch() {
    if (!state.chain) return;
    scheduleSave(state.chain);
    $("chainPushBtn").disabled = false;
}

// ---------- rendering ----------

function render() {
    const c = state.chain;
    $("chainName").value = c ? c.name : "";
    $("chainName").disabled = !c;
    $("chainDeleteBtn").disabled = !c;
    $("chainPushBtn").disabled = !c;
    $("chainRunBtn").disabled = !c || !c.steps.length || state.running;
    $("chainAddStepBtn").hidden = !c;
    $("chainRepoPath").textContent = c && c.repoPath ? c.repoPath : (c ? "not pushed yet" : "");
    renderSteps();
    updateRunStatus();
}

function renderSteps() {
    const list = stepsEl();
    list.innerHTML = "";
    const c = state.chain;
    if (!c) {
        list.innerHTML = `<li class="chain-empty">Pick a chain above, or create a new one.<br><br>
            A chain runs requests top to bottom. Each step can pull values out of its response and hand them to the next step as {{variables}}.</li>`;
        return;
    }
    if (!c.steps.length) {
        list.innerHTML = `<li class="chain-empty">No steps yet. Use “+ Add step” to pull a request from a collection, from the Request tab, or start blank.</li>`;
        return;
    }
    c.steps.forEach((step, i) => list.appendChild(buildCard(step, i)));
    refreshUnresolved();
    c.steps.forEach(s => updateCard(s.id));
}

function buildCard(step, index) {
    const li = document.createElement("li");
    li.className = "chain-step" + (state.expanded.has(step.id) ? " expanded" : "");
    li.dataset.id = step.id;
    li.dataset.status = (state.results.get(step.id) || {}).status || "pending";
    li.setAttribute("draggable", "true");

    li.innerHTML = `
      <div class="cs-head">
        <span class="chain-drag-handle" title="Drag to reorder">⋮⋮</span>
        <span class="cs-num">${index + 1}</span>
        <span class="cs-dot"></span>
        <span class="method method-${escapeHtml(step.request.method)}">${escapeHtml(step.request.method)}</span>
        <input class="cs-label" value="${escapeHtml(step.label)}" placeholder="Step label" title="Step label">
        <span class="cs-url" title="${escapeHtml(step.request.url)}">${escapeHtml(step.request.url || "(no url)")}</span>
        <span class="cs-summary"></span>
        <span class="cs-badge ${step.source ? "linked" : ""}" title="${step.source ? escapeHtml(`${step.source.collection} / ${step.source.requestName}`) : "Not linked to a collection request"}">${step.source ? "linked" : "ad hoc"}</span>
        <span class="cs-actions">
          <button data-act="run-one" title="Run only this step">▶</button>
          <button data-act="run-from" title="Run from this step to the end">▶▶</button>
          <button data-act="open" title="Open in Request tab">↗</button>
          <button data-act="toggle" title="Expand / collapse">${state.expanded.has(step.id) ? "▴" : "▾"}</button>
          <button data-act="remove" class="danger" title="Remove step">×</button>
        </span>
      </div>
      <div class="cs-body" ${state.expanded.has(step.id) ? "" : "hidden"}>
        <div class="cs-pane cs-request">
          <h4>Request</h4>
          <div class="row">
            <select class="cs-method">${["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map(m => `<option ${m === step.request.method ? "selected" : ""}>${m}</option>`).join("")}</select>
            <input type="text" class="cs-url-input" value="${escapeHtml(step.request.url)}" placeholder="https://… ({{variables}} allowed)" spellcheck="false">
          </div>
          <div class="headers-grid"></div>
          <textarea class="cs-body-input" placeholder="Body (raw). {{number}} inserts unquoted, &quot;{{text}}&quot; quoted." spellcheck="false">${escapeHtml(step.request.body || "")}</textarea>
          <div class="cs-unresolved-note"></div>
          <div class="cs-options">
            <label><input type="checkbox" class="cs-opt-continue" ${step.options.continueOnError ? "checked" : ""}> continue on error</label>
            <label><input type="checkbox" class="cs-opt-tls" ${step.options.verifyTls === false ? "" : "checked"}> verify TLS</label>
            <label>delay <input type="number" class="cs-opt-delay" min="0" step="100" value="${Number(step.options.delayMs) || 0}"> ms</label>
          </div>
        </div>
        <div class="cs-pane cs-response">
          <h4>Response <span class="grow"></span><span class="cs-resp-status"></span></h4>
          <div class="cs-pick-hint" hidden></div>
          <details class="cs-resp-headers" hidden><summary>Headers</summary><div class="cs-hdr-list"></div></details>
          <div class="cs-resp-body"><div class="cs-resp-empty">Not run yet</div></div>
        </div>
        <div class="cs-pane cs-outputs">
          <h4>Outputs <span class="grow"></span><span class="msg-muted" style="text-transform:none;letter-spacing:0">values this step passes on as {{variables}}</span></h4>
          <table><thead><tr><th style="width:22%">name</th><th style="width:12%">from</th><th>path / header</th><th style="width:24%">last value</th><th></th><th></th></tr></thead><tbody></tbody></table>
          <div class="out-buttons">
            <button class="btn-small cs-pick-body" title="Click a value in the response to capture its path">+ pick from response</button>
            <button class="btn-small cs-pick-header" title="Click a response header to capture it">+ pick header</button>
            <button class="btn-small cs-add-manual" title="Type a JSON path by hand">+ manual</button>
          </div>
        </div>
      </div>
      <div class="chain-arrow"></div>`;

    // Header grid for this step
    const grid = li.querySelector(".headers-grid");
    step.request.headers.forEach(h => createHeaderRow(h.name, h.value, !!h.isAuth, grid));
    createHeaderRow("", "", false, grid);
    const syncHeaders = () => { step.request.headers = readHeaders(grid); touch(); refreshUnresolved(); refreshUses(); };
    grid.addEventListener("input", syncHeaders);
    grid.addEventListener("change", syncHeaders);

    // Field bindings
    li.querySelector(".cs-label").addEventListener("input", (e) => { step.label = e.target.value; step.labelAuto = false; touch(); });
    li.querySelector(".cs-method").addEventListener("change", (e) => {
        step.request.method = e.target.value; touch();
        const chip = li.querySelector(".cs-head .method"); chip.className = `method method-${step.request.method}`; chip.textContent = step.request.method;
    });
    li.querySelector(".cs-url-input").addEventListener("input", (e) => {
        step.request.url = e.target.value; touch(); refreshUnresolved(); refreshUses();
        const u = li.querySelector(".cs-url"); u.textContent = step.request.url || "(no url)"; u.title = step.request.url;
        if (step.labelAuto && step.request.url) { step.label = shortUrl(step.request.url); li.querySelector(".cs-label").value = step.label; }
    });
    li.querySelector(".cs-body-input").addEventListener("input", (e) => { step.request.body = e.target.value; touch(); refreshUnresolved(); refreshUses(); });
    li.querySelector(".cs-opt-continue").addEventListener("change", (e) => { step.options.continueOnError = e.target.checked; touch(); });
    li.querySelector(".cs-opt-tls").addEventListener("change", (e) => { step.options.verifyTls = e.target.checked; touch(); });
    li.querySelector(".cs-opt-delay").addEventListener("change", (e) => { step.options.delayMs = Math.max(0, Number(e.target.value) || 0); touch(); });

    // Head actions
    li.querySelector(".cs-head").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-act]");
        if (btn) { handleAction(btn.dataset.act, step); return; }
        if (e.target.closest("input, .chain-drag-handle")) return;
        toggleExpanded(step.id);
    });

    // Outputs
    li.querySelector(".cs-pick-body").addEventListener("click", () => startPick(step.id, "body"));
    li.querySelector(".cs-pick-header").addEventListener("click", () => startPick(step.id, "header"));
    li.querySelector(".cs-add-manual").addEventListener("click", () => { step.outputs.push({ name: "", source: "body", path: "$." }); touch(); renderOutputs(step); });

    // Response click (pick mode)
    li.querySelector(".cs-response").addEventListener("click", (e) => {
        if (!state.picking || state.picking.stepId !== step.id) return;
        const val = e.target.closest(".jv-val");
        const hdr = e.target.closest(".cs-hdr-val");
        if (state.picking.source === "body" && val) finishPick(step, "body", val.dataset.path, val.textContent);
        else if (state.picking.source === "header" && hdr) finishPick(step, "header", hdr.dataset.header, hdr.textContent);
    });

    renderOutputs(step, li);
    return li;
}

function cardFor(stepId) {
    return stepsEl().querySelector(`.chain-step[data-id="${stepId}"]`);
}

function toggleExpanded(stepId, force = null) {
    const open = force !== null ? force : !state.expanded.has(stepId);
    if (open) state.expanded.add(stepId); else state.expanded.delete(stepId);
    const li = cardFor(stepId);
    if (!li) return;
    li.classList.toggle("expanded", open);
    li.querySelector(".cs-body").hidden = !open;
    li.querySelector('[data-act="toggle"]').textContent = open ? "▴" : "▾";
}

function renderOutputs(step, li = cardFor(step.id)) {
    if (!li) return;
    const tbody = li.querySelector(".cs-outputs tbody");
    tbody.innerHTML = "";
    const index = state.chain.steps.indexOf(step);
    const result = state.results.get(step.id);
    step.outputs.forEach((o, oi) => {
        const tr = document.createElement("tr");
        const val = result && result.outputs ? result.outputs[o.name] : undefined;
        const missing = result && result.missingOutputs && result.missingOutputs.includes(o.name);
        const uses = o.name ? usesOfOutput(state.chain, index, o.name) : [];
        tr.innerHTML = `
          <td><input type="text" class="out-name" value="${escapeHtml(o.name)}" placeholder="variable" spellcheck="false"></td>
          <td><select class="out-source"><option value="body" ${o.source === "body" ? "selected" : ""}>body</option><option value="header" ${o.source === "header" ? "selected" : ""}>header</option></select></td>
          <td><input type="text" class="out-path" value="${escapeHtml(o.path)}" placeholder="${o.source === "header" ? "Header-Name" : "$.data[0].id"}" spellcheck="false"></td>
          <td class="out-val ${missing ? "missing" : ""}" title="${escapeHtml(val === undefined ? (missing ? "not found in last response" : "") : val)}">${val === undefined ? (missing ? "not found" : "") : escapeHtml(val)}</td>
          <td class="out-uses" title="${uses.length ? "Used by step " + uses.map(u => u + 1).join(", ") : "Not used by a later step yet"}">${uses.length ? "→ " + uses.map(u => u + 1).join(", ") : ""}</td>
          <td><button class="kv-del" title="Remove output">×</button></td>`;
        tr.querySelector(".out-name").addEventListener("change", (e) => {
            const newName = e.target.value.trim().replace(/[^A-Za-z0-9_.\-$]/g, "_");
            const old = o.name;
            if (old && newName && old !== newName && usesOfOutput(state.chain, index, old).length) {
                if (confirm(`Also rename {{${old}}} to {{${newName}}} in the later steps that use it?`)) {
                    const n = renameReferences(state.chain, index, old, newName);
                    toast(`Renamed ${n} reference${n === 1 ? "" : "s"}.`);
                    o.name = newName; touch(); renderSteps(); return;
                }
            }
            o.name = newName; e.target.value = newName; touch(); refreshUnresolved(); renderArrows();
        });
        tr.querySelector(".out-source").addEventListener("change", (e) => { o.source = e.target.value; touch(); renderOutputs(step); });
        tr.querySelector(".out-path").addEventListener("input", (e) => { o.path = e.target.value; touch(); });
        tr.querySelector(".kv-del").addEventListener("click", () => { step.outputs.splice(oi, 1); touch(); renderOutputs(step); refreshUnresolved(); renderArrows(); });
        tbody.appendChild(tr);
    });
    renderArrows();
}

// Update the "used by step N" cells everywhere without rebuilding the tables.
function refreshUses() {
    if (!state.chain) return;
    state.chain.steps.forEach((step, index) => {
        const li = cardFor(step.id);
        if (!li) return;
        li.querySelectorAll(".cs-outputs tbody tr").forEach((tr, oi) => {
            const o = step.outputs[oi];
            if (!o) return;
            const uses = o.name ? usesOfOutput(state.chain, index, o.name) : [];
            const cell = tr.querySelector(".out-uses");
            cell.textContent = uses.length ? "→ " + uses.map(u => u + 1).join(", ") : "";
            cell.title = uses.length ? "Used by step " + uses.map(u => u + 1).join(", ") : "Not used by a later step yet";
        });
    });
}

function renderArrows() {
    if (!state.chain) return;
    state.chain.steps.forEach(step => {
        const li = cardFor(step.id);
        if (!li) return;
        const arrow = li.querySelector(".chain-arrow");
        const result = state.results.get(step.id);
        arrow.innerHTML = step.outputs.filter(o => o.name).map(o => {
            const missing = result && result.missingOutputs && result.missingOutputs.includes(o.name);
            return `<span class="chip ${missing ? "missing" : ""}" title="${escapeHtml(o.source + ": " + o.path)}">{{${escapeHtml(o.name)}}}</span>`;
        }).join("") || `<span class="msg-muted">no outputs</span>`;
    });
}

function updateCard(stepId) {
    const c = state.chain;
    const step = c && c.steps.find(s => s.id === stepId);
    const li = cardFor(stepId);
    if (!step || !li) return;
    const r = state.results.get(stepId);
    li.dataset.status = r ? r.status : "pending";

    const summary = li.querySelector(".cs-summary");
    const status = li.querySelector(".cs-resp-status");
    if (!r) { summary.textContent = ""; status.textContent = ""; }
    else if (r.status === "skipped") { summary.textContent = "skipped"; status.textContent = r.error || "skipped"; }
    else {
        const cls = r.status === "ok" ? "code-ok" : "code-err";
        const code = r.statusCode ? `${r.statusCode} ${r.statusText || ""}`.trim() : (r.error || "error");
        summary.innerHTML = `<span class="${cls}">${escapeHtml(code)}</span>${r.elapsedMs != null ? ` · ${r.elapsedMs} ms` : ""}`;
        status.innerHTML = summary.innerHTML;
    }

    // Response body
    const body = li.querySelector(".cs-resp-body");
    const hdrs = li.querySelector(".cs-resp-headers");
    body.classList.remove("picking");
    if (!r || r.status === "skipped") {
        body.innerHTML = `<div class="cs-resp-empty">${r ? escapeHtml(r.error || "Skipped") : "Not run yet"}</div>`;
        hdrs.hidden = true;
    } else {
        if (r.json !== null && r.json !== undefined) {
            const asTree = renderJsonTree(r.json, body);
            if (!asTree) body.insertAdjacentHTML("afterbegin", `<div class="msg-muted">Too large for click-to-pick; type a path in Outputs instead.</div>`);
        } else if (r.text) {
            body.innerHTML = `<pre class="jv-raw">${escapeHtml(r.text)}</pre>`;
        } else {
            body.innerHTML = `<div class="${r.error ? "cs-resp-error" : "cs-resp-empty"}">${escapeHtml(r.error || "(empty body)")}</div>`;
        }
        const entries = Object.entries(r.headers || {});
        hdrs.hidden = !entries.length;
        hdrs.querySelector("summary").textContent = `Headers (${entries.length})`;
        hdrs.querySelector(".cs-hdr-list").innerHTML = entries.map(([k, v]) =>
            `<div class="cs-hdr-row"><span class="cs-hdr-key">${escapeHtml(k)}:</span><span class="cs-hdr-val" data-header="${escapeHtml(k)}">${escapeHtml(v)}</span></div>`).join("");
    }
    renderOutputs(step, li);
}

function refreshUnresolved() {
    const c = state.chain;
    if (!c) return;
    c.steps.forEach((step, i) => {
        const li = cardFor(step.id);
        if (!li) return;
        const missing = staticUnresolved(c, i, state.envScope);
        const mark = (el, text) => el.classList.toggle("has-unresolved", missing.some(n => (text || "").includes(`{{${n}}}`)));
        mark(li.querySelector(".cs-url-input"), step.request.url);
        mark(li.querySelector(".cs-body-input"), step.request.body);
        li.querySelectorAll(".headers-grid .header-value, .headers-grid .header-key-input").forEach(inp => mark(inp, inp.value));
        li.querySelector(".cs-unresolved-note").textContent = missing.length
            ? `Unresolved before run: ${missing.map(n => `{{${n}}}`).join(", ")} (not in the environment or an earlier step's outputs)` : "";
        li.querySelector(".cs-url").classList.toggle("code-warn", missing.length > 0);
    });
}

function updateRunStatus(text = null) {
    const el = $("chainRunStatus");
    if (text !== null) { el.textContent = text; return; }
    const c = state.chain;
    if (!c) { el.textContent = ""; return; }
    const n = c.steps.length;
    const ran = c.steps.filter(s => state.results.has(s.id)).length;
    const errors = c.steps.filter(s => (state.results.get(s.id) || {}).status === "error").length;
    el.textContent = `${n} step${n === 1 ? "" : "s"}` + (ran ? ` · ${ran} run${errors ? `, ${errors} failed` : ""}` : " · not run");
}

async function updateEnvLabel() {
    const env = await getActiveEnv();
    $("chainEnvLabel").textContent = env ? `env: ${env.name}` : "no environment";
    state.envScope = await activeScope();
    refreshUnresolved();
}

// ---------- actions ----------

function handleAction(act, step) {
    const index = state.chain.steps.indexOf(step);
    if (act === "toggle") toggleExpanded(step.id);
    else if (act === "remove") {
        if (!confirm(`Remove step ${index + 1} "${step.label}"?`)) return;
        state.chain.steps.splice(index, 1); state.results.delete(step.id); touch(); renderSteps(); updateRunStatus();
    }
    else if (act === "open") openInMainTab(step);
    else if (act === "run-one") run({ onlyIndex: index });
    else if (act === "run-from") run({ fromIndex: index });
}

function openInMainTab(step) {
    // Only linked steps carry a meaningful request name into the main tab.
    dataStore.loadRequest({ name: step.source ? step.label : "", ...step.request }, null);
    const r = state.results.get(step.id);
    if (r && r.status !== "skipped") {
        dataStore.responseData = r.json !== null ? formatContent(r.json) : (r.text || "");
        dataStore.responseMeta = { status_code: r.statusCode, status_text: r.statusText, headers: r.headers, elapsed_ms: r.elapsedMs };
    }
    showView("request");
}

function addStepFromMainTab() {
    const snapshot = dataStore.currentRequest();
    if (!snapshot.url) { toast("The Request tab has no URL to add.", "warn"); return; }
    appendStep(newStep({ ...snapshot, name: dataStore.currentName || shortUrl(snapshot.url) }, dataStore.currentRef ? { collection: dataStore.currentRef.path, requestName: dataStore.currentName, path: dataStore.currentRef.path } : null));
}

export function appendStep(step) {
    if (!state.chain) { toast("Create or pick a chain first.", "warn"); return; }
    state.chain.steps.push(step);
    state.expanded.add(step.id);
    touch();
    renderSteps();
    updateRunStatus();
    $("chainRunBtn").disabled = false;
    setTimeout(() => { const li = cardFor(step.id); if (li) li.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 50);
}

function showAddStepMenu(e) {
    const r = e.currentTarget.getBoundingClientRect();
    showContextMenu(r.left, r.top - 130, [
        { label: "From a collection…", onClick: () => openCollectionPicker((request, src) => appendStep(newStep(request, { collection: src.collection, requestName: src.requestName, path: src.path }))) },
        { label: "From the Request tab", onClick: addStepFromMainTab },
        { label: "Blank step", onClick: () => appendStep(newStep({ method: "GET", url: "" }, null)) }
    ]);
}

// ---------- pick mode ----------

function startPick(stepId, source) {
    const li = cardFor(stepId);
    const r = state.results.get(stepId);
    if (!r || r.status === "skipped") { toast("Run this step first, then pick from its response.", "warn"); return; }
    if (source === "body" && (r.json === null || r.json === undefined)) { toast("The response isn't JSON; use a header or type a path.", "warn"); return; }
    if (source === "header" && !Object.keys(r.headers || {}).length) { toast("No response headers to pick from.", "warn"); return; }
    state.picking = { stepId, source };
    li.querySelector(".cs-resp-body").classList.toggle("picking", source === "body");
    li.querySelector(".cs-resp-headers").open = source === "header";
    li.querySelector(".cs-pick-body").classList.toggle("picking", source === "body");
    li.querySelector(".cs-pick-header").classList.toggle("picking", source === "header");
    const hint = li.querySelector(".cs-pick-hint");
    hint.hidden = false;
    hint.textContent = source === "body" ? "Click a value below to capture its path (Esc to cancel)." : "Click a header value to capture it (Esc to cancel).";
}

function cancelPick() {
    if (!state.picking) return;
    const li = cardFor(state.picking.stepId);
    state.picking = null;
    if (!li) return;
    li.querySelector(".cs-resp-body").classList.remove("picking");
    li.querySelector(".cs-pick-body").classList.remove("picking");
    li.querySelector(".cs-pick-header").classList.remove("picking");
    li.querySelector(".cs-pick-hint").hidden = true;
}

function finishPick(step, source, path, sampleText) {
    cancelPick();
    const lastSeg = source === "header" ? path : (path.match(/([A-Za-z_$][A-Za-z0-9_$]*)(?:\[\d+\])*$/) || [])[1] || "value";
    const suggested = lastSeg.replace(/[^A-Za-z0-9_]/g, "").replace(/^./, c => c.toLowerCase()) || "value";
    const name = prompt(`Variable name for ${source === "header" ? "header" : "path"} ${path}\n(sample: ${String(sampleText).slice(0, 60)})`, uniqueName(step, suggested));
    if (!name) return;
    step.outputs.push({ name: name.trim().replace(/[^A-Za-z0-9_.\-$]/g, "_"), source, path });
    touch();
    // Reflect the value immediately using the last result.
    const r = state.results.get(step.id);
    if (r) { r.outputs = r.outputs || {}; const v = extractSingle(step.outputs[step.outputs.length - 1], r); if (v !== undefined) r.outputs[step.outputs[step.outputs.length - 1].name] = v; }
    renderOutputs(step);
    refreshUnresolved();
}

function extractSingle(output, r) {
    if (output.source === "header") {
        const k = Object.keys(r.headers || {}).find(h => h.toLowerCase() === output.path.toLowerCase());
        return k ? r.headers[k] : undefined;
    }
    try { return r.json === null ? undefined : stringifyValue(getPath(r.json, output.path)); }
    catch (_) { return undefined; }
}

function uniqueName(step, base) {
    const taken = new Set(step.outputs.map(o => o.name));
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base}${i}`)) i++;
    return `${base}${i}`;
}

// ---------- running ----------

async function run({ fromIndex = 0, onlyIndex = null } = {}) {
    const c = state.chain;
    if (!c || state.running) return;
    // Flip into the running state synchronously so the UI (and tests) can observe it.
    state.running = true;
    state.abort = new AbortController();
    stepsEl().classList.add("running");
    $("chainRunBtn").disabled = true;
    $("chainStopBtn").hidden = false;
    cancelPick();
    await flushSave(c).catch(() => {});
    state.envScope = await activeScope();

    // Clear results for the steps about to run; keep earlier ones for context.
    c.steps.forEach((s, i) => {
        const willRun = onlyIndex !== null ? i === onlyIndex : i >= fromIndex;
        if (willRun) state.results.delete(s.id);
        updateCard(s.id);
    });

    // A full run starts from a clean slate; partial runs reuse what the last run captured.
    const fullRun = onlyIndex === null && fromIndex === 0;
    if (fullRun) state.lastOutputs = {};
    try {
        const { outputs } = await runChain(c, {
            envScope: state.envScope,
            priorOutputs: fullRun ? {} : state.lastOutputs,
            fromIndex, onlyIndex,
            signal: state.abort.signal,
            send: (request, opts) => sendRequest(request, opts),
            onStepStart: (i, step) => {
                state.results.set(step.id, { status: "running" });
                updateCard(step.id);
                updateRunStatus(`running step ${i + 1} of ${c.steps.length}…`);
                toggleExpanded(step.id, true);
            },
            onStepDone: (i, step, result) => {
                state.results.set(step.id, result);
                updateCard(step.id);
                if (result.status === "error") toggleExpanded(step.id, true);
            }
        });
        state.lastOutputs = outputs;
    } catch (err) {
        toast(`Run failed: ${err.message}`, "error");
    } finally {
        state.running = false;
        state.abort = null;
        stepsEl().classList.remove("running");
        $("chainRunBtn").disabled = !c.steps.length;
        $("chainStopBtn").hidden = true;
        renderArrows();
        refreshUnresolved();
        updateRunStatus();
    }
}

// ---------- wiring ----------

document.addEventListener("DOMContentLoaded", async () => {
    $("chainSelect").addEventListener("change", (e) => selectChainValue(e.target.value));
    $("chainNewBtn").addEventListener("click", createChain);
    $("chainDeleteBtn").addEventListener("click", deleteCurrentChain);
    $("chainPushBtn").addEventListener("click", pushCurrentChain);
    $("chainName").addEventListener("input", (e) => { if (state.chain) { state.chain.name = e.target.value; touch(); } });
    $("chainName").addEventListener("blur", () => refreshChainSelect());
    $("chainRunBtn").addEventListener("click", () => run());
    $("chainStopBtn").addEventListener("click", () => { if (state.abort) state.abort.abort(); });
    $("chainAddStepBtn").addEventListener("click", showAddStepMenu);
    $("chainEnvLabel").addEventListener("click", () => openSettings("envs"));
    $("sendToChainBtn").addEventListener("click", async () => {
        if (!state.chain) {
            const name = prompt("No chain open. Name for a new chain:", "New chain");
            if (!name) return;
            const chain = newChain(name.trim());
            await saveDraft(chain);
            setChain(chain);
        }
        addStepFromMainTab();
        showView("chain");
    });

    makeSortable(stepsEl(), {
        itemSelector: ".chain-step",
        handleSelector: ".chain-drag-handle",
        onReorder: (ids) => {
            const byId = new Map(state.chain.steps.map(s => [s.id, s]));
            state.chain.steps = ids.map(id => byId.get(id)).filter(Boolean);
            touch();
            renderSteps();
        }
    });

    document.addEventListener("keydown", (e) => { if (e.key === "Escape") cancelPick(); });
    document.addEventListener("mpj:open-chain", async (e) => {
        setChain(await importChainFile(e.detail));
        showView("chain");
    });
    chainEvents.addEventListener("drafts", refreshChainSelect);
    store.storeEvents.addEventListener("changed", refreshChainSelect);
    envEvents.addEventListener("change", updateEnvLabel);

    await updateEnvLabel();
    const lastId = await getSetting("lastChainDraftId", null);
    if (lastId != null) {
        const d = await loadDraft(lastId);
        if (d) { state.chain = normalizeChain(d); }
    }
    render();
    refreshChainSelect();
});
