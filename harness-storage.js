/*
Party Harness - Copyright (C) 2026 Party Harness contributors
SPDX-License-Identifier: GPL-3.0-only
This program is free software: you can redistribute it and/or modify it under
the GNU General Public License version 3 as published by the Free Software Foundation.
This program is distributed without any warranty; see LICENSE for details.
You should have received a copy of the GNU General Public License along with
this program. If not, see https://www.gnu.org/licenses/.
*/
"use strict";

// IndexedDB is the primary store. Legacy localStorage is migrated only after a
// successful transaction and remains a fallback where IndexedDB is unavailable.
const HarnessStorage = (() => {
  let db = null;
  let queue = Promise.resolve();
  const cache = new Map();
  const keys = ["party-harness-current-state-v1", "party-harness-sessions-v1"];

  function pack(value) {
    if (Array.isArray(value)) return value.map(pack);
    if (!value || value.format !== "party-harness-session") return value;
    if (value.historyEncoding === 1) value = unpack(value);
    const snapshot = structuredClone(value);
    const pool = [];
    const ids = new Map();
    const refs = lines => (lines || []).map(line => {
      const key = JSON.stringify(line);
      if (!ids.has(key)) { ids.set(key, pool.length); pool.push(line); }
      return ids.get(key);
    });
    snapshot.narrativeRefs = refs(snapshot.narrative);
    snapshot.archiveRefs = refs(snapshot.archive);
    delete snapshot.narrative; delete snapshot.archive;
    snapshot.turnCheckpoints = (snapshot.turnCheckpoints || []).map(checkpoint => {
      const next = { ...checkpoint, narrativeRefs: refs(checkpoint.narrative), archiveRefs: refs(checkpoint.archive) };
      delete next.narrative; delete next.archive;
      return next;
    });
    snapshot.transcriptPool = pool;
    snapshot.historyEncoding = 1;
    return snapshot;
  }

  function unpack(value) {
    if (Array.isArray(value)) return value.map(unpack);
    if (!value || value.historyEncoding !== 1) return value;
    if (!Array.isArray(value.transcriptPool)) throw new Error("Session transcript pool is missing.");
    const restore = refs => {
      if (!Array.isArray(refs)) throw new Error("Session transcript references are missing.");
      return refs.map(index => {
        if (!Number.isInteger(index) || index < 0 || index >= value.transcriptPool.length) throw new Error("Session transcript reference is invalid.");
        // Transcript lines are immutable in the runtime; share their text across checkpoints.
        return value.transcriptPool[index];
      });
    };
    const snapshot = { ...value, narrative: restore(value.narrativeRefs), archive: restore(value.archiveRefs) };
    snapshot.turnCheckpoints = (value.turnCheckpoints || []).map(checkpoint => {
      const next = { ...checkpoint, narrative: restore(checkpoint.narrativeRefs), archive: restore(checkpoint.archiveRefs) };
      delete next.narrativeRefs; delete next.archiveRefs;
      return next;
    });
    delete snapshot.transcriptPool; delete snapshot.narrativeRefs; delete snapshot.archiveRefs; delete snapshot.historyEncoding;
    return snapshot;
  }

  function transaction(mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("saves", mode);
      const request = action(tx.objectStore("saves"));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("The browser could not commit the save."));
    });
  }

  async function initialize() {
    if (db) db.close();
    cache.clear();
    try {
      db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("party-harness", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("saves");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("Close other harness tabs to finish upgrading storage."));
      });
      db.onversionchange = () => { db.close(); db = null; };
    } catch { db = null; }
    for (const key of keys) {
      const stored = db ? await transaction("readonly", store => store.get(key)) : undefined;
      if (stored !== undefined) { cache.set(key, unpack(stored)); continue; }
      let legacy;
      try { legacy = JSON.parse(localStorage.getItem(key) || "null"); } catch { legacy = null; }
      if (legacy !== null) {
        cache.set(key, unpack(legacy));
        if (db) {
          await transaction("readwrite", store => store.put(pack(legacy), key));
          // Only release the smaller store after the complete new copy is committed.
          try { localStorage.removeItem(key); } catch { /* migration still succeeded */ }
        }
      }
    }
  }

  function write(key, value, remove = false) {
    // Capture now; mutations while a previous write is pending cannot change this save.
    const copy = remove ? null : structuredClone(value);
    const packed = remove ? null : pack(copy);
    const operation = queue.then(async () => {
      if (db) await transaction("readwrite", store => remove ? store.delete(key) : store.put(packed, key));
      else if (remove) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(packed));
      if (remove) {
        cache.delete(key);
        try { localStorage.removeItem(key); } catch { /* prevent old migration copies where possible */ }
      } else cache.set(key, copy);
    });
    queue = operation.catch(() => {});
    return operation;
  }

  return { initialize, pack, unpack, get: key => cache.get(key),
    put: (key, value) => write(key, value), remove: key => write(key, null, true),
    get mode() { return db ? "IndexedDB" : "localStorage fallback"; } };
})();

if (typeof module !== "undefined") module.exports = HarnessStorage;
