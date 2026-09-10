// Settings modal: repositories + tokens, environments, general options.
// Also owns the environment picker in the request bar (#envSelect).

import { toast, openModal, closeModal, wireModal, escapeHtml } from "./ui.js";
import { getSetting, setSetting } from "./db.js";
import * as repoApi from "./repo-api.js";
import * as store from "./collections-store.js";
import {
    listEnvironments, saveEnvironment, deleteEnvironment, getActiveEnvId, setActiveEnvId,
    importPostmanEnvironment, exportPostmanEnvironment, envEvents
} from "./environments.js";

const modal = () => document.getElementById("settingsModal");

// ---------- tabs ----------

function showPane(name) {
    modal().querySelectorAll(".settings-tabs button").forEach(b => b.classList.toggle("active", b.dataset.pane === name));
    modal().querySelectorAll(".settings-pane").forEach(p => { p.hidden = p.dataset.pane !== name; });
}

export function openSettings(pane = "repos") {
    renderRepos();
    renderEnvironments();
    renderGeneral();
    showPane(pane);
    openModal(modal());
}

// ---------- repos ----------

let editingRepoUrl = null;
let testedBranches = null;
let authInfo = null;   // from /repo/auth-sources

const AUTH_LABEL = { pat: "PAT", msal: "Microsoft sign-in", azcli: "Azure CLI", gcm: "Git Credential Manager" };

async function loadAuthInfo(force = false) {
    if (!authInfo || force) authInfo = await repoApi.authSources();
    return authInfo;
}

// Show/hide the token box and explain what each sign-in method needs on this machine.
async function renderAuthHint() {
    const mode = document.getElementById("repoAuthSelect").value;
    document.getElementById("repoTokenField").hidden = mode !== "pat";
    document.getElementById("msalRow").hidden = mode !== "msal";
    const hint = document.getElementById("repoAuthHint");
    const info = await loadAuthInfo();
    const isAdo = (repoApi.describeRepoUrl(document.getElementById("repoUrlInput").value) || {}).provider === "ado";
    if (mode === "msal") {
        const signedIn = info.msal && info.msal.account;
        document.getElementById("msalSignInBtn").textContent = signedIn ? "Sign in as someone else" : "Sign in with Microsoft";
        document.getElementById("msalSignOutBtn").hidden = !signedIn;
        if (!info.msal || !info.msal.available) { hint.textContent = "The server is missing the msal package (pip install msal)."; hint.className = "msg-error"; }
        else if (signedIn) { hint.textContent = `Signed in as ${info.msal.account}. Short-lived Azure DevOps tokens are fetched as needed; the sign-in is kept on the app's side, nothing in this browser.${isAdo ? "" : " Azure DevOps repositories only."}`; hint.className = isAdo ? "msg-ok" : "msg-error"; }
        else { hint.textContent = "Sign in with your work account in a popup. No PAT, works from source and from the container. Azure DevOps repositories only."; hint.className = "msg-muted"; }
    } else if (mode === "pat") {
        hint.textContent = "The token is stored only in this browser and sent to the local app with each repo call. Scopes: Azure DevOps Code (Read & Write); GitHub fine-grained Contents read/write.";
        hint.className = "msg-muted";
    } else if (mode === "azcli") {
        if (info.in_container) { hint.textContent = "Not available inside the container. Run the app from source (python -m web.app) to use your Azure CLI sign-in."; hint.className = "msg-error"; }
        else if (!info.azcli.available) { hint.textContent = "Azure CLI (az) was not found on this machine. Install it from https://aka.ms/azcli, run `az login`, then restart the app."; hint.className = "msg-error"; }
        else if (!info.azcli.account) { hint.textContent = "Azure CLI is installed but not signed in. Run `az login` in a terminal, then Test again."; hint.className = "msg-error"; }
        else { hint.textContent = `Uses your Azure CLI session (signed in as ${info.azcli.account}) to get short-lived Azure DevOps tokens. No PAT needed; nothing is stored.${isAdo ? "" : " Azure DevOps repositories only."}`; hint.className = isAdo ? "msg-ok" : "msg-error"; }
    } else if (mode === "gcm") {
        if (info.in_container) { hint.textContent = "Not available inside the container. Run the app from source to reuse your git sign-in."; hint.className = "msg-error"; }
        else if (!info.gcm.available) { hint.textContent = "git was not found on this machine."; hint.className = "msg-error"; }
        else { hint.textContent = "Reuses the sign-in Git Credential Manager already holds for this host (the one `git push` uses). If it has none yet, run `git fetch` on a clone of the repo once."; hint.className = "msg-muted"; }
    }
}

async function renderRepos() {
    const list = document.getElementById("repoList");
    const repos = await store.listRepos();
    const active = store.getRepo();
    if (!repos.length) {
        list.innerHTML = `<div class="msg-muted">No repositories yet. Paste an Azure DevOps or GitHub URL below.</div>`;
        return;
    }
    list.innerHTML = "";
    for (const r of repos) {
        const row = document.createElement("div");
        row.className = "list-row" + (active && active.url === r.url ? " selected" : "");
        const authText = (r.auth || "pat") === "pat" ? (r.token ? "PAT saved" : "no token") : `sign-in: ${AUTH_LABEL[r.auth] || r.auth}`;
        row.innerHTML = `
            <div class="grow"><strong>${escapeHtml(r.label || r.url)}</strong>
                <span class="sub">${escapeHtml(r.url)} · ${escapeHtml(r.branch || "default branch")} · ${escapeHtml(authText)}</span></div>
            <button class="btn-small" data-act="use">Use</button>
            <button class="btn-small" data-act="edit">Edit</button>
            <button class="btn-small danger" data-act="del">Delete</button>`;
        row.querySelector('[data-act="use"]').addEventListener("click", async () => {
            await store.setActiveRepo(r);
            renderRepos();
            toast(`Using ${r.label || r.url}`);
        });
        row.querySelector('[data-act="edit"]').addEventListener("click", () => fillRepoForm(r));
        row.querySelector('[data-act="del"]').addEventListener("click", async () => {
            if (!confirm(`Remove ${r.label || r.url} and its saved token from this browser?`)) return;
            await store.deleteRepo(r.url);
            renderRepos();
        });
        list.appendChild(row);
    }
}

function fillRepoForm(r) {
    editingRepoUrl = r ? r.url : null;
    document.getElementById("repoUrlInput").value = r ? r.url : "";
    document.getElementById("repoAuthSelect").value = r ? (r.auth || "pat") : "pat";
    document.getElementById("repoTokenInput").value = r ? (r.token || "") : "";
    renderAuthHint();
    const sel = document.getElementById("repoBranchInput");
    sel.innerHTML = "";
    if (r && r.branch) sel.appendChild(new Option(r.branch, r.branch, true, true));
    document.getElementById("repoTestMsg").textContent = "";
    document.getElementById("repoTestMsg").className = "msg-muted";
    testedBranches = null;
}

async function testRepo() {
    const url = document.getElementById("repoUrlInput").value.trim();
    const auth = document.getElementById("repoAuthSelect").value;
    const token = document.getElementById("repoTokenInput").value.trim();
    const msg = document.getElementById("repoTestMsg");
    const desc = repoApi.describeRepoUrl(url);
    if (!desc) { msg.textContent = "That doesn't look like an Azure DevOps or GitHub repo URL."; msg.className = "msg-error"; return null; }
    if (auth === "pat" && !token) { msg.textContent = "Paste a Personal Access Token first, or pick another sign-in method."; msg.className = "msg-error"; return null; }
    if ((auth === "azcli" || auth === "msal") && desc.provider !== "ado") { msg.textContent = `${AUTH_LABEL[auth]} only works for Azure DevOps repositories.`; msg.className = "msg-error"; return null; }
    if (auth === "msal" && !((await loadAuthInfo(true)).msal || {}).account) { msg.textContent = "Click “Sign in with Microsoft” first."; msg.className = "msg-error"; return null; }
    msg.textContent = "Testing…"; msg.className = "msg-muted";
    try {
        const info = await repoApi.ping({ url, token, auth });
        const sel = document.getElementById("repoBranchInput");
        const current = sel.value;
        sel.innerHTML = "";
        for (const b of info.branches || []) sel.appendChild(new Option(b, b));
        sel.value = (info.branches || []).includes(current) ? current : info.default_branch;
        testedBranches = info.branches;
        msg.textContent = `OK via ${AUTH_LABEL[auth]}: ${info.name} (${desc.provider === "ado" ? "Azure DevOps" : "GitHub"}), default branch ${info.default_branch}.`;
        msg.className = "msg-ok";
        return { ...desc, info };
    } catch (err) {
        msg.textContent = err.message;
        msg.className = "msg-error";
        return null;
    }
}

async function saveRepoForm() {
    const url = document.getElementById("repoUrlInput").value.trim();
    const auth = document.getElementById("repoAuthSelect").value;
    const token = auth === "pat" ? document.getElementById("repoTokenInput").value.trim() : "";
    const branch = document.getElementById("repoBranchInput").value || "";
    const desc = repoApi.describeRepoUrl(url);
    if (!desc) { toast("Unrecognized repo URL.", "error"); return; }
    if ((auth === "azcli" || auth === "msal") && desc.provider !== "ado") { toast(`${AUTH_LABEL[auth]} only works for Azure DevOps repositories.`, "error"); return; }
    if (editingRepoUrl && editingRepoUrl !== url) await store.deleteRepo(editingRepoUrl);
    const repo = { url, token, auth, branch, provider: desc.provider, label: desc.label, lastPulled: null };
    await store.saveRepo(repo);
    if (!store.getRepo() || store.getRepo().url === url) await store.setActiveRepo(repo);
    fillRepoForm(null);
    renderRepos();
    toast("Repository saved.");
}

// ---------- environments ----------

let editingEnvId = null;

async function renderEnvironments() {
    const list = document.getElementById("envList");
    const envs = await listEnvironments();
    const activeId = await getActiveEnvId();
    list.innerHTML = "";
    if (!envs.length) list.innerHTML = `<div class="msg-muted">No environments yet. Create one, or drop a *.postman_environment.json file here.</div>`;
    for (const e of envs) {
        const row = document.createElement("div");
        row.className = "list-row" + (e.id === editingEnvId ? " selected" : "");
        const n = Object.keys(e.vars || {}).length;
        row.innerHTML = `
            <input type="radio" name="activeEnv" title="Active environment" ${e.id === activeId ? "checked" : ""}>
            <div class="grow"><strong>${escapeHtml(e.name)}</strong><span class="sub">${n} variable${n === 1 ? "" : "s"}</span></div>
            <button class="btn-small" data-act="edit">Edit</button>
            <button class="btn-small" data-act="export">Export</button>
            <button class="btn-small danger" data-act="del">Delete</button>`;
        row.querySelector("input").addEventListener("change", () => setActiveEnvId(e.id));
        row.querySelector('[data-act="edit"]').addEventListener("click", () => fillEnvForm(e));
        row.querySelector('[data-act="export"]').addEventListener("click", () => downloadText(`${e.name}.postman_environment.json`, exportPostmanEnvironment(e)));
        row.querySelector('[data-act="del"]').addEventListener("click", async () => {
            if (!confirm(`Delete environment "${e.name}"?`)) return;
            await deleteEnvironment(e.id);
            if (editingEnvId === e.id) fillEnvForm(null);
            renderEnvironments();
        });
        list.appendChild(row);
    }
}

function fillEnvForm(env) {
    editingEnvId = env ? env.id : null;
    document.getElementById("envNameInput").value = env ? env.name : "";
    const grid = document.getElementById("envVarsGrid");
    grid.innerHTML = "";
    const entries = env ? Object.entries(env.vars || {}) : [];
    entries.forEach(([k, v]) => addKvRow(grid, k, v));
    addKvRow(grid, "", "");
    document.getElementById("envFormTitle").textContent = env ? `Edit "${env.name}"` : "New environment";
    renderEnvironments();
}

function addKvRow(grid, key, value) {
    const k = document.createElement("input"); k.placeholder = "variable"; k.value = key;
    const v = document.createElement("input"); v.placeholder = "value"; v.value = value;
    const del = document.createElement("button"); del.className = "kv-del"; del.textContent = "×"; del.title = "Remove";
    const rowEls = [k, v, del];
    const isLast = () => grid.lastElementChild === del;
    const onInput = () => { if (isLast() && (k.value || v.value)) addKvRow(grid, "", ""); };
    k.addEventListener("input", onInput);
    v.addEventListener("input", onInput);
    del.addEventListener("click", () => { if (!isLast()) rowEls.forEach(el => el.remove()); });
    rowEls.forEach(el => grid.appendChild(el));
}

function readKvGrid(grid) {
    const vars = {};
    const cells = Array.from(grid.children);
    for (let i = 0; i + 2 < cells.length; i += 3) {
        const k = cells[i].value.trim();
        if (k) vars[k] = cells[i + 1].value;
    }
    return vars;
}

async function saveEnvForm() {
    const name = document.getElementById("envNameInput").value.trim();
    if (!name) { toast("Give the environment a name.", "warn"); return; }
    const vars = readKvGrid(document.getElementById("envVarsGrid"));
    const id = await saveEnvironment({ id: editingEnvId ?? undefined, name, vars });
    if ((await getActiveEnvId()) == null) await setActiveEnvId(id);
    editingEnvId = id;
    fillEnvForm({ id, name, vars });
    toast("Environment saved.");
}

async function importEnvFile(file) {
    try {
        const env = importPostmanEnvironment(await file.text());
        const id = await saveEnvironment(env);
        if ((await getActiveEnvId()) == null) await setActiveEnvId(id);
        fillEnvForm({ id, ...env });
        toast(`Imported "${env.name}" with ${Object.keys(env.vars).length} variables.`);
    } catch (err) {
        toast(`Import failed: ${err.message}`, "error");
    }
}

function downloadText(filename, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Request-bar picker
export async function renderEnvSelect() {
    const sel = document.getElementById("envSelect");
    if (!sel) return;
    const envs = await listEnvironments();
    const activeId = await getActiveEnvId();
    sel.innerHTML = "";
    sel.appendChild(new Option("No environment", ""));
    for (const e of envs) sel.appendChild(new Option(e.name, String(e.id), false, e.id === activeId));
    if (activeId == null) sel.value = "";
}

// ---------- general ----------

async function renderGeneral() {
    document.getElementById("verifyTlsDefault").checked = await getSetting("verifyTls", true);
}

// ---------- wiring ----------

document.addEventListener("DOMContentLoaded", async () => {
    const m = modal();
    wireModal(m);
    m.querySelectorAll(".settings-tabs button").forEach(b => b.addEventListener("click", () => showPane(b.dataset.pane)));

    document.getElementById("settingsBtn").addEventListener("click", () => openSettings("repos"));

    document.getElementById("repoTestBtn").addEventListener("click", testRepo);
    document.getElementById("repoSaveBtn").addEventListener("click", saveRepoForm);
    document.getElementById("repoClearBtn").addEventListener("click", () => fillRepoForm(null));
    document.getElementById("repoUrlInput").addEventListener("input", () => {
        const d = repoApi.describeRepoUrl(document.getElementById("repoUrlInput").value);
        const msg = document.getElementById("repoTestMsg");
        msg.textContent = d ? `${d.provider === "ado" ? "Azure DevOps" : "GitHub"}: ${d.label}` : "";
        msg.className = "msg-muted";
        renderAuthHint();
    });
    document.getElementById("repoAuthSelect").addEventListener("change", renderAuthHint);
    document.getElementById("msalSignInBtn").addEventListener("click", async () => {
        const btn = document.getElementById("msalSignInBtn");
        btn.disabled = true; btn.textContent = "Waiting for the sign-in window…";
        try {
            const account = await repoApi.msalSignIn();
            await loadAuthInfo(true);
            toast(`Signed in as ${account}.`);
        } catch (err) {
            toast(err.message, "error", 7000);
        } finally {
            btn.disabled = false;
            renderAuthHint();
        }
    });
    document.getElementById("msalSignOutBtn").addEventListener("click", async () => {
        await repoApi.msalSignOut();
        await loadAuthInfo(true);
        renderAuthHint();
        toast("Signed out.");
    });
    // Default the dropdown to whatever already works here: Microsoft sign-in stays the default,
    // but if the Azure CLI is signed in and no repos exist yet, offer that instead.
    loadAuthInfo().then(async (info) => {
        if (!(await store.listRepos()).length) {
            if (info.msal && info.msal.account) document.getElementById("repoAuthSelect").value = "msal";
            else if (info.azcli && info.azcli.account) document.getElementById("repoAuthSelect").value = "azcli";
            renderAuthHint();
        }
    });

    document.getElementById("envNewBtn").addEventListener("click", () => fillEnvForm(null));
    document.getElementById("envSaveBtn").addEventListener("click", saveEnvForm);
    document.getElementById("envImportInput").addEventListener("change", (e) => {
        if (e.target.files[0]) importEnvFile(e.target.files[0]);
        e.target.value = "";
    });
    const envPane = m.querySelector('.settings-pane[data-pane="envs"]');
    ["dragenter", "dragover"].forEach(ev => envPane.addEventListener(ev, e => { e.preventDefault(); }));
    envPane.addEventListener("drop", e => {
        e.preventDefault();
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) importEnvFile(f);
    });

    document.getElementById("verifyTlsDefault").addEventListener("change", async (e) => {
        await setSetting("verifyTls", e.target.checked);
        const skip = document.getElementById("skipTlsCheck");
        if (skip) skip.checked = !e.target.checked;
    });

    const envSelect = document.getElementById("envSelect");
    envSelect.addEventListener("change", () => setActiveEnvId(envSelect.value === "" ? null : Number(envSelect.value)));
    envEvents.addEventListener("change", () => { renderEnvSelect(); if (m.classList.contains("open")) renderEnvironments(); });
    store.storeEvents.addEventListener("repo", () => { if (m.classList.contains("open")) renderRepos(); });

    const skip = document.getElementById("skipTlsCheck");
    if (skip) skip.checked = !(await getSetting("verifyTls", true));
    fillRepoForm(null);
    fillEnvForm(null);
    renderEnvSelect();
});
