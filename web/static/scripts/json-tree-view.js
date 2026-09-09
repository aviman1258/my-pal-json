// Render a JSON value as nested, clickable spans. Every leaf value carries data-path
// (e.g. $.data.items[0].id) so a click can be turned into an extraction path.

const MAX_NODES = 5000;

function pathSegment(key) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `.${key}` : `["${String(key).replace(/"/g, '\\"')}"]`;
}

export function countNodes(value, limit = MAX_NODES) {
    let n = 0;
    const walk = (v) => {
        if (n > limit) return;
        n++;
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(value);
    return n;
}

// Returns true when rendered as a tree, false when it fell back to plain text.
export function renderJsonTree(value, container, { maxNodes = MAX_NODES } = {}) {
    container.innerHTML = "";
    if (countNodes(value, maxNodes) > maxNodes) {
        const pre = document.createElement("pre");
        pre.className = "jv-raw";
        pre.textContent = JSON.stringify(value, null, 2);
        container.appendChild(pre);
        return false;
    }
    const root = document.createElement("div");
    root.className = "jv-root";
    root.appendChild(renderValue(value, "$"));
    container.appendChild(root);
    return true;
}

function leaf(value, path) {
    const span = document.createElement("span");
    const type = value === null ? "null" : typeof value;
    span.className = `jv-val jv-${type}`;
    span.dataset.path = path;
    span.title = path;
    span.textContent = type === "string" ? JSON.stringify(value) : String(value);
    return span;
}

function renderValue(value, path) {
    if (value === null || typeof value !== "object") return leaf(value, path);

    const isArr = Array.isArray(value);
    const entries = isArr ? value.map((v, i) => [i, v]) : Object.entries(value);
    const wrap = document.createElement("span");
    wrap.className = isArr ? "jv-array" : "jv-object";

    const open = document.createElement("span");
    open.className = "jv-bracket jv-toggle";
    open.textContent = isArr ? "[" : "{";
    open.title = `${path} (click to collapse)`;
    open.dataset.path = path;
    wrap.appendChild(open);

    if (!entries.length) {
        wrap.appendChild(Object.assign(document.createElement("span"), { className: "jv-bracket", textContent: isArr ? "]" : "}" }));
        return wrap;
    }

    const count = document.createElement("span");
    count.className = "jv-count";
    count.textContent = `${entries.length} ${isArr ? "items" : "keys"}`;
    wrap.appendChild(count);

    const body = document.createElement("div");
    body.className = "jv-children";
    for (const [k, v] of entries) {
        const row = document.createElement("div");
        row.className = "jv-row";
        const childPath = isArr ? `${path}[${k}]` : `${path}${pathSegment(k)}`;
        if (!isArr) {
            const key = document.createElement("span");
            key.className = "jv-key";
            key.textContent = JSON.stringify(k);
            row.appendChild(key);
            row.appendChild(Object.assign(document.createElement("span"), { className: "jv-colon", textContent: ": " }));
        } else {
            const idx = document.createElement("span");
            idx.className = "jv-index";
            idx.textContent = `${k}: `;
            row.appendChild(idx);
        }
        row.appendChild(renderValue(v, childPath));
        body.appendChild(row);
    }
    wrap.appendChild(body);
    wrap.appendChild(Object.assign(document.createElement("span"), { className: "jv-bracket", textContent: isArr ? "]" : "}" }));

    open.addEventListener("click", (e) => {
        e.stopPropagation();
        wrap.classList.toggle("jv-collapsed");
    });
    return wrap;
}
