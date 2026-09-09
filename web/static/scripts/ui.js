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

export function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
