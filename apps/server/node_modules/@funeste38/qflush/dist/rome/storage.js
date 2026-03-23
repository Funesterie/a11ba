"use strict";
// ROME-TAG: 0x75DEC5
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
exports.saveTelemetryEvent = saveTelemetryEvent;
exports.getRecentTelemetry = getRecentTelemetry;
exports.saveEngineHistory = saveEngineHistory;
exports.getEngineHistory = getEngineHistory;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Lightweight storage helper: prefer sqlite (better-sqlite3) if available,
// otherwise fallback to a JSON file under .qflush/storage.json
const DEFAULT_DIR = path.join(process.cwd(), '.qflush');
const JSON_PATH = path.join(DEFAULT_DIR, 'storage.json');
let db = null;
let useSqlite = false;
function ensureDir() {
    try {
        if (!fs.existsSync(DEFAULT_DIR))
            fs.mkdirSync(DEFAULT_DIR, { recursive: true });
    }
    catch (e) {
        console.warn('[storage] ensureDir failed', String(e));
    }
}
try {
    // attempt to use better-sqlite3 if installed
    const Database = require('better-sqlite3');
    const dbPath = path.join(DEFAULT_DIR, 'qflush.db');
    db = new Database(dbPath);
    // initialize tables
    db.exec(`CREATE TABLE IF NOT EXISTS telemetry (id TEXT PRIMARY KEY, type TEXT, ts INTEGER, payload TEXT);
            CREATE TABLE IF NOT EXISTS engine_history (id TEXT PRIMARY KEY, ts INTEGER, path TEXT, action TEXT, result TEXT);
            `);
    useSqlite = true;
}
catch (e) {
    // fallback to JSON
    useSqlite = false;
    console.warn('[storage] sqlite init failed', String(e));
}
function writeJsonFile(obj) {
    ensureDir();
    try {
        fs.writeFileSync(JSON_PATH + '.tmp', JSON.stringify(obj, null, 2), 'utf8');
        fs.renameSync(JSON_PATH + '.tmp', JSON_PATH);
    }
    catch (e) {
        console.warn('[storage] writeJsonFile failed', String(e));
    }
}
function readJsonFile() {
    try {
        if (!fs.existsSync(JSON_PATH))
            return { telemetry: [], engine_history: [] };
        const raw = fs.readFileSync(JSON_PATH, 'utf8') || '{}';
        return JSON.parse(raw);
    }
    catch (e) {
        console.warn('[storage] readJsonFile failed', String(e));
        return { telemetry: [], engine_history: [] };
    }
}
function saveTelemetryEvent(id, type, timestamp, payload) {
    if (useSqlite && db) {
        try {
            const stmt = db.prepare('INSERT OR REPLACE INTO telemetry (id,type,ts,payload) VALUES (?,?,?,?)');
            stmt.run(id, type, timestamp, JSON.stringify(payload));
            return true;
        }
        catch (e) {
            console.warn('[storage] saveTelemetryEvent sqlite failed', String(e));
            return false;
        }
    }
    // json fallback
    const obj = readJsonFile();
    obj.telemetry = obj.telemetry || [];
    obj.telemetry.push({ id, type, ts: timestamp, payload });
    writeJsonFile(obj);
    return true;
}
function getRecentTelemetry(limit = 100) {
    if (useSqlite && db) {
        try {
            const stmt = db.prepare('SELECT id,type,ts,payload FROM telemetry ORDER BY ts DESC LIMIT ?');
            const rows = stmt.all(limit);
            return rows.map((r) => ({ id: r.id, type: r.type, ts: r.ts, payload: JSON.parse(r.payload) }));
        }
        catch (e) {
            console.warn('[storage] getRecentTelemetry sqlite failed', String(e));
            return [];
        }
    }
    const obj = readJsonFile();
    const arr = obj.telemetry || [];
    return arr.slice(-limit).reverse();
}
function saveEngineHistory(id, timestamp, pathVal, action, result) {
    if (useSqlite && db) {
        try {
            const stmt = db.prepare('INSERT OR REPLACE INTO engine_history (id,ts,path,action,result) VALUES (?,?,?,?,?)');
            stmt.run(id, timestamp, pathVal, action, JSON.stringify(result));
            return true;
        }
        catch (e) {
            console.warn('[storage] saveEngineHistory sqlite failed', String(e));
            return false;
        }
    }
    const obj = readJsonFile();
    obj.engine_history = obj.engine_history || [];
    obj.engine_history.push({ id, ts: timestamp, path: pathVal, action, result });
    writeJsonFile(obj);
    return true;
}
function getEngineHistory(limit = 100) {
    if (useSqlite && db) {
        try {
            const stmt = db.prepare('SELECT id,ts,path,action,result FROM engine_history ORDER BY ts DESC LIMIT ?');
            const rows = stmt.all(limit);
            return rows.map((r) => ({ id: r.id, ts: r.ts, path: r.path, action: r.action, result: JSON.parse(r.result) }));
        }
        catch (e) {
            console.warn('[storage] getEngineHistory sqlite failed', String(e));
            return [];
        }
    }
    const obj = readJsonFile();
    const arr = obj.engine_history || [];
    return arr.slice(-limit).reverse();
}
