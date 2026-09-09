// Top-level view strip: Request view (the classic single-request screen) vs Chain view.

export const viewEvents = new EventTarget();

const VIEWS = {
    request: { tab: "viewRequestTab", section: "requestView" },
    chain: { tab: "viewChainTab", section: "chainView" }
};

export function currentView() {
    return document.getElementById("chainView").hidden ? "request" : "chain";
}

export function showView(name) {
    if (!VIEWS[name]) name = "request";
    for (const [key, ids] of Object.entries(VIEWS)) {
        document.getElementById(ids.section).hidden = key !== name;
        document.getElementById(ids.tab).classList.toggle("active", key === name);
    }
    try { localStorage.setItem("view", name); } catch (_) { /* ignore */ }
    viewEvents.dispatchEvent(new CustomEvent("change", { detail: name }));
}

document.addEventListener("DOMContentLoaded", () => {
    for (const [key, ids] of Object.entries(VIEWS)) {
        document.getElementById(ids.tab).addEventListener("click", () => showView(key));
    }
    let saved = "request";
    try { saved = localStorage.getItem("view") || "request"; } catch (_) { /* ignore */ }
    showView(saved);
});
