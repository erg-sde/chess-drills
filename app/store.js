// Tiny IndexedDB key-value store (falls back to memory if IndexedDB is unavailable).
const DB = "chess-drills", OS = "kv";
let dbp = null;
function open() {
  if (!dbp) dbp = new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(OS);
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
  return dbp;
}
const mem = new Map();
async function tx(mode, fn) {
  const db = await open();
  if (!db) return fn(null);
  return new Promise((res, rej) => { const t = db.transaction(OS, mode), s = t.objectStore(OS), r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); });
}
export const store = {
  async get(k) { const db = await open(); if (!db) return mem.get(k); return tx("readonly", (s) => s.get(k)); },
  async set(k, v) { const db = await open(); if (!db) { mem.set(k, v); return; } return tx("readwrite", (s) => s.put(v, k)); },
  async del(k) { const db = await open(); if (!db) { mem.delete(k); return; } return tx("readwrite", (s) => s.delete(k)); },
  async clear() { const db = await open(); if (!db) { mem.clear(); return; } return tx("readwrite", (s) => s.clear()); },
};
