// Small shared UI helpers: toast, modal open/close, context menu, HTML escaping.

let toastTimer = null;

export function toast(message, kind = "info", ms = 3500) {
    let el = document.getElementById("toast");
    if (!el) {
        el = document.createElement("div");
        el.id = "toast";
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = kind;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

export function openModal(el) {
    el.classList.add("open");
    const first = el.querySelector("input, select, textarea, button:not(.close)");
    if (first) setTimeout(() => first.focus(), 0);
}

export function closeModal(el) {
    el.classList.remove("open");
}

// Close a modal when its overlay or any [data-close] element is clicked.
export function wireModal(el) {
    el.addEventListener("click", (e) => {
        if (e.target === el || e.target.closest("[data-close]")) closeModal(el);
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && el.classList.contains("open")) closeModal(el);
    });
}

// items: [{ label, onClick, danger?, sep? }]
export function showContextMenu(x, y, items) {
    hideContextMenu();
    const menu = document.createElement("div");
    menu.className = "ctx-menu";
    menu.id = "ctxMenu";
    for (const it of items) {
        if (it.sep) { menu.appendChild(document.createElement("hr")); continue; }
        const b = document.createElement("button");
        b.textContent = it.label;
        if (it.danger) b.classList.add("danger");
        b.addEventListener("click", () => { hideContextMenu(); it.onClick(); });
        menu.appendChild(b);
    }
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.min(x, window.innerWidth - rect.width - 8) + "px";
    menu.style.top = Math.min(y, window.innerHeight - rect.height - 8) + "px";
    setTimeout(() => {
        document.addEventListener("click", hideContextMenu, { once: true });
        document.addEventListener("contextmenu", hideContextMenu, { once: true });
    }, 0);
}

export function hideContextMenu() {
    const m = document.getElementById("ctxMenu");
    if (m) m.remove();
}

// Editable key/value grid (three columns: key, value, delete) with an always-present empty
// trailing row. `onChange(vars)` fires after every edit. Returns { read, focusKey }.
export function mountKvGrid(grid, entries = {}, onChange = () => {}, { keyPlaceholder = "name", valuePlaceholder = "value" } = {}) {
    grid.innerHTML = "";

    function read() {
        const vars = {};
        const cells = Array.from(grid.children);
        for (let i = 0; i + 2 < cells.length; i += 3) {
            const k = cells[i].value.trim();
            if (k) vars[k] = cells[i + 1].value;
        }
        return vars;
    }

    function addRow(key, value) {
        const k = document.createElement("input"); k.placeholder = keyPlaceholder; k.value = key; k.spellcheck = false;
        const v = document.createElement("input"); v.placeholder = valuePlaceholder; v.value = value; v.spellcheck = false;
        const del = document.createElement("button"); del.className = "kv-del"; del.type = "button"; del.textContent = "×"; del.title = "Remove";
        const els = [k, v, del];
        const isLast = () => grid.lastElementChild === del;
        const onInput = () => { if (isLast() && (k.value || v.value)) addRow("", ""); onChange(read()); };
        k.addEventListener("input", onInput);
        v.addEventListener("input", onInput);
        del.addEventListener("click", () => { if (isLast()) { k.value = ""; v.value = ""; } else els.forEach(el => el.remove()); onChange(read()); });
        els.forEach(el => grid.appendChild(el));
        return { k, v };
    }

    Object.entries(entries).forEach(([k, v]) => addRow(k, v));
    addRow("", "");

    // Add (or focus) a key and put the cursor in its value cell.
    function focusKey(name) {
        const cells = Array.from(grid.children);
        for (let i = 0; i + 2 < cells.length; i += 3) {
            if (cells[i].value.trim() === name) { cells[i + 1].focus(); return; }
        }
        const last = cells.length >= 3 ? cells[cells.length - 3] : null;
        if (last && last.value.trim() === "") {
            last.value = name;
            addRow("", "");
            onChange(read());
            cells[cells.length - 2].focus();
        } else {
            const row = addRow(name, "");
            addRow("", "");
            onChange(read());
            row.v.focus();
        }
    }

    return { read, focusKey };
}

export function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
