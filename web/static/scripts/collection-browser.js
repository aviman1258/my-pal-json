// Collections drawer: repo/branch picker, pull, tree of collections, load/save/save-as, push.

import { toast, openModal, closeModal, wireModal, showContextMenu, escapeHtml } from "./ui.js";
import * as store from "./collections-store.js";
import * as repoApi from "./repo-api.js";
import {
    itemToRequest, requestToItem, inheritedAuth, addRequest, addFolder, renameNode, deleteNode,
    duplicateNode, scrubSecrets, walkRequests, nodePath, fileBaseName
} from "./postman.js";
import { dataStore, requestEvents } from "./send-request.js";
import { openSettings } from "./settings-panel.js";

const drawer = () => document.getElementById("collectionsDrawer");
const treeEl = () => document.getElementById("collectionTree");

const uiState = {
    collapsed: new Set(),       // node ids collapsed
    selectedNodeId: null,
    pickMode: null              // { onPick } when the chain tab is choosing a request
};

// ---------- open / close ----------

export function openDrawer() {
    drawer().classList.add("open");
    if (store.getRepo() && !store.getFiles().length && !store.isPulling()) doPull();
}
export function closeDrawer() { drawer().classList.remove("open"); uiState.pickMode = null; setPickBanner(); }
export function toggleDrawer() { drawer().classList.contains("open") ? closeDrawer() : openDrawer(); }

// Chain tab hook: open the drawer and hand the chosen request back instead of loading it.
export function openCollectionPicker(onPick) {
    uiState.pickMode = { onPick };
    setPickBanner();
    openDrawer();
}

function setPickBanner() {
    const el = document.getElementById("pickBanner");
    if (el) el.hidden = !uiState.pickMode;
}

// ---------- header controls ----------

async function renderRepoControls() {
    const repos = await store.listRepos();
    const active = store.getRepo();
    const repoSel = document.getElementById("repoSelect");
    repoSel.innerHTML = "";
    if (!repos.length) repoSel.appendChild(new Option("No repositories – open Settings", ""));
    for (const r of repos) repoSel.appendChild(new Option(r.label || r.url, r.url, false, active && active.url === r.url));
    if (!active) repoSel.value = "";

    const branchSel = document.getElementById("branchSelect");
    if (active) {
        const branch = active.branch || "";
        const hasFullList = branchSel.options.length > 1 && Array.from(branchSel.options).some(o => o.value === branch);
        if (!hasFullList) {
            branchSel.innerHTML = "";
            branchSel.appendChild(new Option(branch || "(default)", branch, true, true));
        }
        branchSel.value = branch;
        branchSel.disabled = false;
    } else {
        branchSel.innerHTML = "";
        branchSel.appendChild(new Option("branch", ""));
        branchSel.disabled = true;
    }
    document.getElementById("pullBtn").disabled = !active || store.isPulling();
    renderDirtyBadge();
}

function renderDirtyBadge() {
    const n = store.dirtyFiles().length;
    document.getElementById("dirtyBadge").textContent = n ? String(n) : "";
    document.getElementById("pushBtn").disabled = n === 0;
}

async function loadBranches() {
    const active = store.getRepo();
    if (!active) return;
    try {
        const info = await repoApi.ping(active);
        if (!active.branch) await store.setBranch(info.default_branch);
        const current = store.getRepo().branch || info.default_branch;
        const sel = document.getElementById("branchSelect");
        sel.innerHTML = "";
        for (const b of info.branches || []) sel.appendChild(new Option(b, b, false, b === current));
        sel.value = current;
    } catch (err) {
        toast(err.message, "error");
    }
}

async function doPull() {
    if (!store.getRepo()) { toast("Pick a repository first (Settings).", "warn"); return; }
    const btn = document.getElementById("pullBtn");
    btn.disabled = true; btn.textContent = "Pulling…";
    try {
        await store.pull();
        const files = store.getFiles();
        toast(`Pulled ${files.length} file${files.length === 1 ? "" : "s"}.`);
    } catch (err) {
        toast(`Pull failed: ${err.message}`, "error", 6000);
    } finally {
        btn.disabled = false; btn.textContent = "Pull";
    }
}

// ---------- tree ----------

function renderTree() {
    const el = treeEl();
    const files = store.getFiles().sort((a, b) => a.path.localeCompare(b.path));
    if (!store.getRepo()) { el.innerHTML = `<div class="tree-empty">No repository selected.<br><br><button class="btn-small" id="treeOpenSettings">Open Settings</button></div>`; el.querySelector("#treeOpenSettings").onclick = () => openSettings("repos"); return; }
    if (store.isPulling() && !files.length) { el.innerHTML = `<div class="tree-empty">Pulling…</div>`; return; }
    if (!files.length) { el.innerHTML = `<div class="tree-empty">No collections found.<br>Pull, or create one with “+”.</div>`; return; }

    const ul = document.createElement("ul");
    for (const f of files) {
        if (f.kind === "collection" && f.collection) ul.appendChild(renderNode(f.collection.root, f));
        else ul.appendChild(renderFileLeaf(f));
    }
    el.innerHTML = "";
    el.appendChild(ul);
}

function renderFileLeaf(file) {
    const li = document.createElement("li");
    li.className = `tree-node kind-${file.kind || "file"}`;
    const row = document.createElement("div");
    row.className = "tree-row";
    row.innerHTML = `<span class="tree-caret"></span><span class="tree-label">${escapeHtml(fileBaseName(file.path))}</span>` +
        (file.dirty ? `<span class="tree-dirty" title="Unpushed changes">•</span>` : "") +
        (file.error ? `<span class="msg-error" title="${escapeHtml(file.error)}">!</span>` : "");
    row.title = file.path + (file.error ? `\n${file.error}` : "");
    if (file.kind === "chain") {
        row.addEventListener("click", () => document.dispatchEvent(new CustomEvent("mpj:open-chain", { detail: file })));
    }
    row.addEventListener("contextmenu", e => { e.preventDefault(); showFileMenu(e.clientX, e.clientY, file); });
    li.appendChild(row);
    return li;
}

function renderNode(node, file) {
    const li = document.createElement("li");
    li.className = `tree-node kind-${node.kind}`;
    li.dataset.nodeId = node.id;
    if (uiState.collapsed.has(node.id)) li.classList.add("collapsed");

    const row = document.createElement("div");
    row.className = "tree-row" + (uiState.selectedNodeId === node.id ? " selected" : "");
    const hasChildren = node.kind !== "request";
    const caret = hasChildren ? (li.classList.contains("collapsed") ? "▸" : "▾") : "";
    const method = node.kind === "request" ? methodOf(node.item) : "";
    row.innerHTML =
        `<span class="tree-caret">${caret}</span>` +
        (method ? `<span class="method method-${method}">${method}</span>` : "") +
        `<span class="tree-label">${escapeHtml(node.name)}</span>` +
        (node.kind === "collection" && file.dirty ? `<span class="tree-dirty" title="Unpushed changes">•</span>` : "") +
        `<button class="tree-menu" title="Actions">⋯</button>`;
    row.title = node.kind === "collection" ? file.path : nodePath(node).join(" / ");

    row.addEventListener("click", (e) => {
        if (e.target.closest(".tree-menu")) return;
        if (hasChildren) {
            if (uiState.collapsed.has(node.id)) uiState.collapsed.delete(node.id); else uiState.collapsed.add(node.id);
            renderTree();
        } else {
            selectRequest(node, file);
        }
    });
    row.querySelector(".tree-menu").addEventListener("click", (e) => { e.stopPropagation(); const r = e.target.getBoundingClientRect(); showNodeMenu(r.left, r.bottom, node, file); });
    row.addEventListener("contextmenu", (e) => { e.preventDefault(); showNodeMenu(e.clientX, e.clientY, node, file); });
    li.appendChild(row);

    if (hasChildren) {
        const ul = document.createElement("ul");
        for (const c of node.children) ul.appendChild(renderNode(c, file));
        li.appendChild(ul);
    }
    return li;
}

function methodOf(item) {
    const r = item.request;
    return (typeof r === "string" ? "GET" : (r && r.method) || "GET").toUpperCase();
}

function selectRequest(node, file) {
    const request = itemToRequest(node.item, inheritedAuth(node));
    if (uiState.pickMode) {
        const onPick = uiState.pickMode.onPick;
        uiState.pickMode = null; setPickBanner();
        closeDrawer();
        onPick(request, { collection: file.collection.name, requestName: node.name, path: file.path });
        return;
    }
    uiState.selectedNodeId = node.id;
    dataStore.loadRequest(request, { path: file.path, node });
    if (request.bodyMode === "other") toast("This request uses a body mode other than raw; the body is shown read-only.", "warn", 5000);
    renderTree();
    closeDrawer();
}

// ---------- menus ----------

function showNodeMenu(x, y, node, file) {
    const items = [];
    if (node.kind !== "request") {
        items.push({ label: "New request here", onClick: () => newRequestIn(node, file) });
        items.push({ label: "New folder here", onClick: () => newFolderIn(node, file) });
        items.push({ sep: true });
    }
    items.push({ label: "Rename", onClick: () => rename(node, file) });
    if (node.kind !== "collection") items.push({ label: "Duplicate", onClick: () => { duplicateNode(node); store.markDirty(file.path); renderTree(); } });
    if (node.kind === "collection") {
        if (file.dirty) items.push({ label: "Discard local changes", onClick: () => revertFile(file) });
        items.push({ sep: true });
        items.push({ label: "Delete collection file", danger: true, onClick: () => deleteCollectionFile(file) });
    } else {
        items.push({ sep: true });
        items.push({ label: "Delete", danger: true, onClick: () => {
            if (!confirm(`Delete "${node.name}"${node.kind === "folder" ? " and everything in it" : ""}?`)) return;
            if (dataStore.currentRef && dataStore.currentRef.node === node) dataStore.clearRef();
            deleteNode(node); store.markDirty(file.path); renderTree();
        } });
    }
    showContextMenu(x, y, items);
}

function showFileMenu(x, y, file) {
    const items = [];
    if (file.dirty) items.push({ label: "Discard local changes", onClick: () => revertFile(file) });
    items.push({ label: "Delete file", danger: true, onClick: () => deleteCollectionFile(file) });
    showContextMenu(x, y, items);
}

function newRequestIn(node, file) {
    const name = prompt("Request name:", "New Request");
    if (!name) return;
    const snapshot = dataStore.currentRequest();
    const useForm = snapshot.url && confirm("Start from the request currently in the form? (Cancel = blank request)");
    const req = useForm ? { ...snapshot, name } : { name, method: "GET", url: "", headers: [], body: null, bodyMode: "none" };
    const newNode = addRequest(file.collection, node, req);
    store.markDirty(file.path);
    uiState.collapsed.delete(node.id);
    selectRequest(newNode, file);
}

function newFolderIn(node, file) {
    const name = prompt("Folder name:", "New Folder");
    if (!name) return;
    addFolder(file.collection, node, name);
    store.markDirty(file.path);
    uiState.collapsed.delete(node.id);
    renderTree();
}

function rename(node, file) {
    const name = prompt("New name:", node.name);
    if (!name || name === node.name) return;
    renameNode(node, name);
    if (dataStore.currentRef && dataStore.currentRef.node === node) { dataStore.currentName = name; dataStore.loadRequest(itemToRequest(node.item, inheritedAuth(node)), dataStore.currentRef); }
    store.markDirty(file.path);
    renderTree();
}

async function revertFile(file) {
    if (!confirm(`Discard local changes to ${file.path}?`)) return;
    try { await store.revert(file.path); toast("Reverted."); } catch (err) { toast(err.message, "error"); }
    if (dataStore.currentRef && dataStore.currentRef.path === file.path) dataStore.clearRef();
    renderTree();
}

async function deleteCollectionFile(file) {
    const remote = file.version != null;
    if (!confirm(`Delete ${file.path}${remote ? " from the repository (this commits a deletion)" : ""}?`)) return;
    const message = remote ? (prompt("Commit message:", `Delete ${fileBaseName(file.path)} via My Pal JSON`) || "") : "";
    if (remote && !message) return;
    try {
        await store.removeFile(file.path, message);
        if (dataStore.currentRef && dataStore.currentRef.path === file.path) dataStore.clearRef();
        toast("Deleted.");
    } catch (err) { toast(err.message, "error", 6000); }
}

async function newCollection() {
    if (!store.getRepo()) { toast("Pick a repository first (Settings).", "warn"); return; }
    const name = prompt("Collection name:", "");
    if (!name) return;
    try {
        const entry = store.createCollectionFile(name);
        toast(`Created ${entry.path} (push to commit it).`);
    } catch (err) { toast(err.message, "error"); }
}

// ---------- save / save as ----------

function replaceItem(node, patched) {
    const arr = node.parent.kind === "collection" ? node.parent.item.item : node.parent.item.item;
    const i = arr.indexOf(node.item);
    if (i >= 0) arr[i] = patched;
    node.item = patched;
    node.name = patched.name;
}

export function saveCurrentRequest() {
    const ref = dataStore.currentRef;
    if (!ref) { openSaveAs(); return; }
    const file = store.getFile(ref.path);
    if (!file || !file.collection) { toast("The collection this request came from is no longer loaded.", "error"); return; }
    const snapshot = dataStore.currentRequest();
    const original = itemToRequest(ref.node.item, inheritedAuth(ref.node));
    if (original.bodyMode === "other") snapshot.bodyMode = "other";
    const patched = requestToItem({ ...snapshot, name: dataStore.currentName || ref.node.name }, ref.node.item);
    replaceItem(ref.node, patched);
    store.markDirty(file.path);
    dataStore.formDirty = false;
    dataStore.loadRequest(itemToRequest(patched, inheritedAuth(ref.node)), ref);
    renderTree();
    toast(`Saved to ${fileBaseName(file.path)} (push to commit).`);
}

function openSaveAs() {
    if (!store.getRepo()) { toast("Pick a repository first (Settings).", "warn"); return; }
    const files = store.getFiles().filter(f => f.kind === "collection" && f.collection);
    const colSel = document.getElementById("saveAsCollection");
    colSel.innerHTML = "";
    for (const f of files) colSel.appendChild(new Option(f.collection.name, f.path));
    colSel.appendChild(new Option("+ New collection…", "__new__"));
    document.getElementById("saveAsNewName").parentElement.hidden = true;
    document.getElementById("saveAsName").value = dataStore.currentName || "";
    fillSaveAsFolders();
    openModal(document.getElementById("saveAsModal"));
}

function fillSaveAsFolders() {
    const colSel = document.getElementById("saveAsCollection");
    const folderSel = document.getElementById("saveAsFolder");
    const newWrap = document.getElementById("saveAsNewName").parentElement;
    folderSel.innerHTML = "";
    if (colSel.value === "__new__") { newWrap.hidden = false; folderSel.appendChild(new Option("(root)", "")); return; }
    newWrap.hidden = true;
    const file = store.getFile(colSel.value);
    if (!file) return;
    const walk = (node, depth) => {
        if (node.kind === "request") return;
        folderSel.appendChild(new Option((depth ? "  ".repeat(depth) + "↳ " : "") + (depth ? node.name : "(root)"), node.id));
        for (const c of node.children) walk(c, depth + 1);
    };
    walk(file.collection.root, 0);
}

function findNodeById(root, id) {
    if (root.id === id) return root;
    for (const c of root.children || []) { const r = findNodeById(c, id); if (r) return r; }
    return null;
}

function confirmSaveAs() {
    const colSel = document.getElementById("saveAsCollection");
    const name = document.getElementById("saveAsName").value.trim();
    if (!name) { toast("Give the request a name.", "warn"); return; }
    let file;
    try {
        if (colSel.value === "__new__") {
            const newName = document.getElementById("saveAsNewName").value.trim();
            if (!newName) { toast("Give the new collection a name.", "warn"); return; }
            file = store.createCollectionFile(newName);
        } else {
            file = store.getFile(colSel.value);
        }
    } catch (err) { toast(err.message, "error"); return; }
    const folderId = document.getElementById("saveAsFolder").value;
    const parent = folderId ? findNodeById(file.collection.root, folderId) : file.collection.root;
    const snapshot = { ...dataStore.currentRequest(), name };
    const node = addRequest(file.collection, parent, snapshot);
    store.markDirty(file.path);
    closeModal(document.getElementById("saveAsModal"));
    uiState.selectedNodeId = node.id;
    dataStore.loadRequest(itemToRequest(node.item, inheritedAuth(node)), { path: file.path, node });
    renderTree();
    toast(`Saved as "${name}" in ${file.collection.name} (push to commit).`);
}

// ---------- push ----------

function openPush() {
    const dirty = store.dirtyFiles();
    if (!dirty.length) { toast("Nothing to push.", "info"); return; }
    const list = document.getElementById("pushList");
    list.innerHTML = "";
    for (const f of dirty) {
        const label = document.createElement("label");
        label.innerHTML = `<input type="checkbox" checked data-path="${escapeHtml(f.path)}"> ${escapeHtml(f.path)} ${f.version == null ? "<span class='msg-muted'>(new)</span>" : ""}`;
        list.appendChild(label);
    }
    document.getElementById("commitMessage").value = dirty.length === 1
        ? `Update ${fileBaseName(dirty[0].path)} via My Pal JSON` : "Update collections via My Pal JSON";
    document.getElementById("scrubSummary").textContent = "";
    document.getElementById("pushResult").textContent = "";
    openModal(document.getElementById("pushModal"));
}

async function confirmPush() {
    const paths = Array.from(document.querySelectorAll("#pushList input:checked")).map(i => i.dataset.path);
    const message = document.getElementById("commitMessage").value.trim() || "Update via My Pal JSON";
    const summary = document.getElementById("scrubSummary");
    const result = document.getElementById("pushResult");
    const btn = document.getElementById("confirmPushBtn");
    if (!paths.length) { toast("Select at least one file.", "warn"); return; }

    // Scrub secrets in every request of every selected collection before serializing.
    const scrubbed = [];
    for (const p of paths) {
        const f = store.getFile(p);
        if (f && f.kind === "collection" && f.collection) {
            for (const node of walkRequests(f.collection.root)) {
                const appHeaders = itemToRequest(node.item, inheritedAuth(node)).headers;
                scrubSecrets(node.item, appHeaders).forEach(c => scrubbed.push(`${fileBaseName(p)} › ${node.name}: ${c.where} → ${c.to}`));
            }
        }
    }
    summary.innerHTML = scrubbed.length
        ? `Replaced ${scrubbed.length} secret-looking value${scrubbed.length === 1 ? "" : "s"} with placeholders:<br>${scrubbed.map(escapeHtml).join("<br>")}` : "";

    btn.disabled = true;
    const lines = [];
    for (const p of paths) {
        try {
            await store.push(p, message);
            lines.push(`<span class="msg-ok">✓ ${escapeHtml(p)}</span>`);
        } catch (err) {
            const hint = err.status === 409 ? " — pull to reload, or discard local changes from the tree menu." : "";
            lines.push(`<span class="msg-error">✗ ${escapeHtml(p)}: ${escapeHtml(err.message)}${hint}</span>`);
        }
        result.innerHTML = lines.join("<br>");
    }
    btn.disabled = false;
    renderTree();
    if (!store.dirtyFiles().length) { toast("Pushed."); setTimeout(() => closeModal(document.getElementById("pushModal")), 800); }
}

// ---------- wiring ----------

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("collectionsBtn").addEventListener("click", toggleDrawer);
    document.getElementById("closeDrawer").addEventListener("click", closeDrawer);
    document.getElementById("pullBtn").addEventListener("click", doPull);
    document.getElementById("pushBtn").addEventListener("click", openPush);
    document.getElementById("newCollectionBtn").addEventListener("click", newCollection);
    document.getElementById("drawerSettingsBtn").addEventListener("click", () => openSettings("repos"));
    document.getElementById("cancelPickBtn").addEventListener("click", () => { uiState.pickMode = null; setPickBanner(); });

    document.getElementById("repoSelect").addEventListener("change", async (e) => {
        const repos = await store.listRepos();
        const r = repos.find(x => x.url === e.target.value) || null;
        await store.setActiveRepo(r);
        if (r) { await loadBranches(); doPull(); }
    });
    document.getElementById("branchSelect").addEventListener("focus", loadBranches, { once: true });
    document.getElementById("branchSelect").addEventListener("change", async (e) => {
        await store.setBranch(e.target.value);
        doPull();
    });

    document.getElementById("saveRequestBtn").addEventListener("click", saveCurrentRequest);
    document.getElementById("saveAsBtn").addEventListener("click", openSaveAs);
    document.getElementById("saveAsCollection").addEventListener("change", fillSaveAsFolders);
    document.getElementById("confirmSaveAsBtn").addEventListener("click", confirmSaveAs);
    document.getElementById("confirmPushBtn").addEventListener("click", confirmPush);
    wireModal(document.getElementById("saveAsModal"));
    wireModal(document.getElementById("pushModal"));

    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveCurrentRequest(); }
    });

    store.storeEvents.addEventListener("changed", () => { renderTree(); renderDirtyBadge(); });
    store.storeEvents.addEventListener("repo", () => { renderRepoControls(); renderTree(); });
    store.storeEvents.addEventListener("repos", renderRepoControls);
    requestEvents.addEventListener("loaded", (e) => {
        uiState.selectedNodeId = e.detail.ref ? e.detail.ref.node.id : null;
        renderTree();
    });

    const repo = await store.restoreActiveRepo();
    await renderRepoControls();
    renderTree();
    if (repo) { loadBranches(); doPull(); }
});
