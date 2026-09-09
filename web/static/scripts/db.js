// Shared IndexedDB wrapper. The only place indexedDB.open is called.
//
// Stores (v2):
//   settings     { key, value }                                        keyPath "key"
//   repos        { url, provider, branch, token, label, lastPulled }   keyPath "url"
//   environments { id, name, vars: {k: v} }                            keyPath "id" (auto)
//   chainDrafts  { draftId, name, ...chain }                           keyPath "draftId" (auto), index "byName"
//
// v1 had an "apiCalls" store (the old save/history feature); it is dropped on upgrade.
const DB_NAME = "MyPalJsonDB";
const DB_VERSION = 2;
let dbPromise = null;

function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (db.objectStoreNames.contains("apiCalls")) db.deleteObjectStore("apiCalls");
            if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
            if (!db.objectStoreNames.contains("repos")) db.createObjectStore("repos", { keyPath: "url" });
            if (!db.objectStoreNames.contains("environments")) db.createObjectStore("environments", { keyPath: "id", autoIncrement: true });
            if (!db.objectStoreNames.contains("chainDrafts")) {
                const s = db.createObjectStore("chainDrafts", { keyPath: "draftId", autoIncrement: true });
                s.createIndex("byName", "name", { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

function run(storeName, mode, fn) {
    return openDb().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const req = fn(tx.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    }));
}

export const dbGet = (store, key) => run(store, "readonly", s => s.get(key));
export const dbGetAll = (store) => run(store, "readonly", s => s.getAll());
export const dbPut = (store, value) => run(store, "readwrite", s => s.put(value));
export const dbDelete = (store, key) => run(store, "readwrite", s => s.delete(key));
export const dbClear = (store) => run(store, "readwrite", s => s.clear());

// Convenience for the settings store.
export async function getSetting(key, fallback = null) {
    const row = await dbGet("settings", key);
    return row ? row.value : fallback;
}
export const setSetting = (key, value) => dbPut("settings", { key, value });
