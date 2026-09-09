// Moves literal secrets out of files that are about to be pushed and into an environment.
//
// The allocator hands out variable names for (key, value) pairs:
//   - same value already stored under a name derived from the same key -> reuse that name
//   - key unused                                                        -> camelCase(key), e.g. apiKey
//   - key taken by a different value                                    -> apiKey2, apiKey3, ...
// It never overwrites an existing environment value.

import { toCamel } from "./postman.js";

export function createSecretAllocator(existingVars = {}) {
    const vars = { ...existingVars };
    const moved = [];   // [{ name, value, where }]

    const taken = (name) => Object.keys(vars).some(n => n.toLowerCase() === name.toLowerCase());

    function nameFor(key, value, where = "") {
        const base = toCamel(key);
        for (const [n, v] of Object.entries(vars)) {
            if (v === value && n.replace(/\d+$/, "").toLowerCase() === base.toLowerCase()) return n;   // same secret, same family
        }
        let name = base;
        for (let i = 2; taken(name); i++) name = `${base}${i}`;
        vars[name] = value;
        moved.push({ name, value, where });
        return name;
    }

    return { nameFor, get vars() { return vars; }, get moved() { return moved; } };
}

// Human-readable summary lines for a confirm dialog or push summary.
export function describeMoves(moved) {
    return moved.map(m => `${m.where ? m.where + ": " : ""}${mask(m.value)} → {{${m.name}}}`);
}

export function mask(value) {
    const s = String(value);
    if (s.length <= 8) return "•".repeat(s.length);
    return s.slice(0, 3) + "•".repeat(Math.min(8, s.length - 6)) + s.slice(-3);
}
