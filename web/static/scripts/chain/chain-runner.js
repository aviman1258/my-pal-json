// Chain execution engine. Pure functions plus one async runner; no DOM access.
//
// A chain step:
//   { id, label, source, request: {method,url,headers,body}, outputs: [{name, source: "body"|"header", path}],
//     options: { continueOnError, delayMs, verifyTls } }
//
// A step result:
//   { status: "ok"|"error"|"skipped", statusCode, statusText, headers, json, text, elapsedMs,
//     outputs: {name: value}, missingOutputs: [name], unresolved: [name], error }

import { resolveRequest, findVars, getPath, stringifyValue, buildScope } from "../variables.js";

export class UnresolvedVarError extends Error {
    constructor(names) {
        super(`Unresolved variable${names.length === 1 ? "" : "s"}: ${names.join(", ")}`);
        this.name = "UnresolvedVarError";
        this.unresolved = names;
    }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Names every step before `index` declares as outputs.
export function outputsBefore(chain, index) {
    const names = new Set();
    for (let i = 0; i < index && i < chain.steps.length; i++) {
        for (const o of chain.steps[i].outputs || []) if (o.name) names.add(o.name);
    }
    return names;
}

// All {{vars}} a step's request references.
export function varsInStep(step) {
    const r = step.request || {};
    const names = new Set(findVars(r.url));
    for (const h of r.headers || []) { findVars(h.name).forEach(n => names.add(n)); findVars(h.value).forEach(n => names.add(n)); }
    findVars(r.body).forEach(n => names.add(n));
    return Array.from(names);
}

// Static check: variables the step uses that neither the environment nor an earlier step provides.
export function staticUnresolved(chain, index, envScope = {}) {
    const known = outputsBefore(chain, index);
    return varsInStep(chain.steps[index]).filter(n => !known.has(n) && !(n in envScope));
}

// Steps after `index` that reference output `name`.
export function usesOfOutput(chain, index, name) {
    const users = [];
    for (let i = index + 1; i < chain.steps.length; i++) {
        if (varsInStep(chain.steps[i]).includes(name)) users.push(i);
    }
    return users;
}

// Rename {{old}} -> {{new}} in every step after `index`. Returns number of replacements.
export function renameReferences(chain, index, oldName, newName) {
    const re = new RegExp(`\\{\\{\\s*${oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`, "g");
    let count = 0;
    const sub = (s) => typeof s === "string" ? s.replace(re, () => { count++; return `{{${newName}}}`; }) : s;
    for (let i = index + 1; i < chain.steps.length; i++) {
        const r = chain.steps[i].request;
        r.url = sub(r.url);
        r.body = sub(r.body);
        for (const h of r.headers || []) { h.name = sub(h.name); h.value = sub(h.value); }
    }
    return count;
}

// Parse the proxy envelope into json/text.
export function parseEnvelope(envelope) {
    let json = null, text = "";
    const c = envelope.content;
    if (c !== null && typeof c === "object") { json = c; text = JSON.stringify(c, null, 2); }
    else if (typeof c === "string") {
        text = c;
        try { json = JSON.parse(c); } catch (_) { json = null; }
    }
    return { json, text };
}

export function extractOutputs(step, envelope) {
    const { json } = parseEnvelope(envelope);
    const headers = envelope.headers || {};
    const lowerHeaders = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const outputs = {};
    const missing = [];
    for (const o of step.outputs || []) {
        if (!o.name) continue;
        let v;
        if (o.source === "header") v = lowerHeaders[String(o.path || "").toLowerCase()];
        else v = json === null ? undefined : getPath(json, o.path);
        const s = stringifyValue(v);
        if (s === undefined) missing.push(o.name); else outputs[o.name] = s;
    }
    return { outputs, missing };
}

// Resolve, send, extract. `send(request, {verifyTls})` returns the proxy envelope.
export async function runStep(step, scope, send) {
    const started = performance.now();
    const { request, unresolved } = resolveRequest(step.request, scope);
    if (unresolved.length) throw new UnresolvedVarError(unresolved);
    const opts = step.options || {};
    if (opts.delayMs > 0) await sleep(opts.delayMs);
    const envelope = await send(request, { verifyTls: opts.verifyTls !== false });
    const { json, text } = parseEnvelope(envelope);
    const { outputs, missing } = extractOutputs(step, envelope);
    const code = envelope.status_code || 0;
    return {
        status: code >= 400 || code === 0 ? "error" : "ok",
        statusCode: code,
        statusText: envelope.status_text || "",
        headers: envelope.headers || {},
        json, text,
        elapsedMs: envelope.elapsed_ms != null ? envelope.elapsed_ms : Math.round(performance.now() - started),
        outputs, missingOutputs: missing, unresolved: [],
        error: code >= 400 ? `HTTP ${code} ${envelope.status_text || ""}`.trim() : null,
        resolvedRequest: request
    };
}

// Run steps sequentially.
//   envScope      environment variables
//   priorOutputs  outputs captured by an earlier run (so "run from step 3" still has step 1's token)
//   fromIndex     first step to actually execute; earlier ones are marked skipped
//   onlyIndex     run just this one step (uses priorOutputs + env as scope)
export async function runChain(chain, {
    envScope = {}, priorOutputs = {}, fromIndex = 0, onlyIndex = null,
    onStepStart = () => {}, onStepDone = () => {}, signal = null, send
} = {}) {
    const results = new Map();
    let outputs = { ...priorOutputs };
    let stopped = false;

    for (let i = 0; i < chain.steps.length; i++) {
        const step = chain.steps[i];
        const shouldRun = onlyIndex !== null ? i === onlyIndex : i >= fromIndex;
        if (!shouldRun || stopped || (signal && signal.aborted)) {
            if (shouldRun) { // stopped or aborted
                const r = { status: "skipped", error: signal && signal.aborted ? "Stopped" : "Skipped after an earlier error" };
                results.set(step.id, r); onStepDone(i, step, r);
            }
            continue;
        }
        onStepStart(i, step);
        const scope = buildScope(envScope, outputs);
        let result;
        try {
            result = await runStep(step, scope, send);
        } catch (err) {
            result = {
                status: "error", statusCode: 0, headers: {}, json: null, text: "", outputs: {}, missingOutputs: [],
                unresolved: err instanceof UnresolvedVarError ? err.unresolved : [],
                error: err.message
            };
        }
        Object.assign(outputs, result.outputs);
        results.set(step.id, result);
        onStepDone(i, step, result);
        if (result.status === "error" && !(step.options && step.options.continueOnError)) stopped = true;
    }
    return { results, outputs, stopped };
}
