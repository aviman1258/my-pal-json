// Environments: named sets of {{variable}} values, stored only in the browser.
// This is the app's replacement for Postman's *.postman_environment.json files.

import { dbGetAll, dbPut, dbDelete, getSetting, setSetting } from "./db.js";

export const envEvents = new EventTarget();
const emit = () => envEvents.dispatchEvent(new Event("change"));

export function listEnvironments() {
    return dbGetAll("environments");
}

export async function saveEnvironment(env) {
    const clean = { ...env, name: (env.name || "Untitled").trim(), vars: env.vars || {} };
    if (clean.id == null) delete clean.id;
    const id = await dbPut("environments", clean);
    emit();
    return id;
}

export async function deleteEnvironment(id) {
    await dbDelete("environments", id);
    if ((await getActiveEnvId()) === id) await setActiveEnvId(null);
    emit();
}

export function getActiveEnvId() {
    return getSetting("activeEnvId", null);
}

export async function setActiveEnvId(id) {
    await setSetting("activeEnvId", id);
    emit();
}

export async function getActiveEnv() {
    const id = await getActiveEnvId();
    if (id == null) return null;
    const all = await listEnvironments();
    return all.find(e => e.id === id) || null;
}

// The variable scope to substitute with: active environment vars, or {} when none.
export async function activeScope() {
    const env = await getActiveEnv();
    return env ? { ...env.vars } : {};
}

// Postman environment export -> { name, vars }. Disabled entries are skipped.
export function importPostmanEnvironment(json) {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (!data || !Array.isArray(data.values)) throw new Error("Not a Postman environment (missing values[])");
    const vars = {};
    for (const v of data.values) {
        if (v && v.key && v.enabled !== false) vars[v.key] = v.value == null ? "" : String(v.value);
    }
    return { name: data.name || "Imported", vars };
}

export function exportPostmanEnvironment(env) {
    return JSON.stringify({
        name: env.name,
        values: Object.entries(env.vars || {}).map(([key, value]) => ({ key, value, type: "default", enabled: true })),
        _postman_variable_scope: "environment"
    }, null, "\t");
}
