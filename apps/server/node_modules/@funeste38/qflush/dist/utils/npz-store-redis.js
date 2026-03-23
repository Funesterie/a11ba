"use strict";
// ROME-TAG: 0xC27F4F
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRecord = createRecord;
exports.updateRecord = updateRecord;
exports.getRecord = getRecord;
exports.deleteRecord = deleteRecord;
exports.listRecords = listRecords;
exports.clearAll = clearAll;
exports.__internal_size = __internal_size;
// Redis implementation removed - use in-memory fallback to avoid external dependency.
const uuid_1 = require("uuid");
const npz_config_js_1 = require("./npz-config.js");
// NOTE: this module intentionally does NOT depend on ioredis anymore.
// It exposes the same async API but stores data in memory with TTL semantics.
const NS = (0, npz_config_js_1.getNpzNamespace)();
const store = new Map();
function nowMs() { return Date.now(); }
async function createRecord(meta) {
    const id = (0, uuid_1.v4)();
    const rec = { id, ts: nowMs(), meta };
    // default TTL 24h
    const expiresAt = nowMs() + 24 * 3600 * 1000;
    store.set(id, Object.assign({}, rec, { expiresAt }));
    return rec;
}
async function updateRecord(id, patch) {
    const entry = store.get(id);
    if (!entry)
        return null;
    const updated = Object.assign({}, entry, patch);
    store.set(id, updated);
    // return shallow copy
    const copy = Object.assign({}, updated);
    delete copy.expiresAt;
    return copy;
}
async function getRecord(id) {
    const entry = store.get(id);
    if (!entry)
        return null;
    if (entry.expiresAt && entry.expiresAt < nowMs()) {
        store.delete(id);
        return null;
    }
    const copy = Object.assign({}, entry);
    delete copy.expiresAt;
    return copy;
}
async function deleteRecord(id) {
    return store.delete(id);
}
async function listRecords() {
    const now = nowMs();
    const res = [];
    for (const [k, v] of store.entries()) {
        if (v.expiresAt && v.expiresAt < now) {
            store.delete(k);
            continue;
        }
        const copy = Object.assign({}, v);
        delete copy.expiresAt;
        res.push(copy);
    }
    return res;
}
async function clearAll() {
    const n = store.size;
    store.clear();
    return n;
}
// helper: not part of original API but useful for tests
function __internal_size() { return store.size; }
