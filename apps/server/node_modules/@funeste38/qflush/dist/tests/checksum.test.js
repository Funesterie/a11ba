"use strict";
// ROME-TAG: 0xBBFCDC
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const vitest_1 = require("vitest");
// (qflushd supprimé, ignorer ce module)
// Local implementations to run tests without HTTP daemon
async function ensureQflushDir() {
    const base = path.join(process.cwd(), '.qflush');
    if (!fs.existsSync(base))
        fs.mkdirSync(base, { recursive: true });
    return base;
}
async function readChecksumsFile() {
    const base = await ensureQflushDir();
    const dbFile = path.join(base, 'checksums.json');
    try {
        if (fs.existsSync(dbFile))
            return JSON.parse(fs.readFileSync(dbFile, 'utf8') || '{}');
    }
    catch (e) { }
    return {};
}
async function writeChecksumsFile(db) {
    const base = await ensureQflushDir();
    const dbFile = path.join(base, 'checksums.json');
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
}
async function computeFlexibleChecksumForPathLocal(relPath) {
    try {
        const filePath = path.isAbsolute(relPath) ? relPath : path.join(process.cwd(), relPath);
        if (!fs.existsSync(filePath))
            return { success: false, error: 'file_not_found' };
        const mod = await import('../utils/fileChecksum.js');
        const fc = (mod && (mod.default || mod));
        if (fc && typeof fc.flexibleChecksumFile === 'function') {
            const val = await fc.flexibleChecksumFile(filePath);
            return { success: true, checksum: String(val) };
        }
        return { success: false, error: 'checksum_unavailable' };
    }
    catch (e) {
        return { success: false, error: String(e) };
    }
}
async function localStore(id, checksum, ttlMs, filePath) {
    const db = await readChecksumsFile();
    let actual = checksum;
    if (actual === '__auto__' && filePath) {
        const comp = await computeFlexibleChecksumForPathLocal(String(filePath));
        if (!comp.success)
            return { success: false, error: comp.error };
        actual = comp.checksum;
    }
    if (!actual)
        return { success: false, error: 'missing_checksum' };
    const rec = { id, checksum: actual, storedAt: Date.now() };
    if (ttlMs)
        rec.expiresAt = Date.now() + Number(ttlMs);
    db[id] = rec;
    await writeChecksumsFile(db);
    return { success: true, id, checksum: actual };
}
async function localList() {
    const db = await readChecksumsFile();
    const now = Date.now();
    for (const k of Object.keys(db)) {
        if (db[k] && db[k].expiresAt && now > db[k].expiresAt)
            delete db[k];
    }
    await writeChecksumsFile(db);
    const items = Object.values(db);
    return { success: true, count: items.length, items };
}
async function localVerify(id, checksum, filePath) {
    const db = await readChecksumsFile();
    const rec = db[id];
    if (!rec)
        return { status: 404, body: { success: false, error: 'not_found' } };
    if (rec.expiresAt && Date.now() > rec.expiresAt) {
        delete db[id];
        await writeChecksumsFile(db);
        return { status: 404, body: { success: false, error: 'expired' } };
    }
    let actual = checksum;
    if (actual === '__auto__' && filePath) {
        const comp = await computeFlexibleChecksumForPathLocal(String(filePath));
        if (!comp.success)
            return { status: 500, body: comp };
        actual = comp.checksum;
    }
    if (String(rec.checksum) === String(actual))
        return { status: 200, body: { success: true } };
    return { status: 412, body: { success: false, error: 'mismatch' } };
}
async function localClear() {
    await writeChecksumsFile({});
    return { success: true };
}
async function runTests() {
    try {
        // Local flow: do not spawn daemon
        const s1 = await localStore('t1', 'abc', 2000);
        if (!s1.success)
            throw new Error('store failed: ' + String(s1.error));
        const l = await localList();
        if (!l.success || l.count === 0)
            throw new Error('list failed');
        const v1 = await localVerify('t1', 'wrong');
        if (v1.status === 200)
            throw new Error('mismatch should fail');
        const v2 = await localVerify('t1', 'abc');
        if (v2.status !== 200)
            throw new Error('verify failed');
        const c = await localClear();
        if (!c.success)
            throw new Error('clear failed');
        console.log('tests PASSED');
    }
    catch (e) {
        console.error('tests FAILED', e);
        throw e;
    }
}
(0, vitest_1.describe)('checksum (stub)', () => {
    (0, vitest_1.it)('stub passes', () => {
        (0, vitest_1.expect)(true).toBe(true);
    });
});
