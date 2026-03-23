"use strict";
// ROME-TAG: 0x11D9FC
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRequestRecord = createRequestRecord;
exports.updateRequestRecord = updateRequestRecord;
exports.getRequestRecord = getRequestRecord;
const fs_1 = __importDefault(require("fs"));
const path = __importStar(require("path"));
const npz_store_redis_js_1 = require("./npz-store-redis.js");
const npz_config_js_1 = require("./npz-config.js");
const NS = (0, npz_config_js_1.getNpzNamespace)();
// Use .qflush as canonical state directory (was .qflush)
const STORE_DIR = path.join(process.cwd(), '.qflush');
const REQUEST_STORE = path.join(STORE_DIR, `${NS}-npz-requests.json`);
let fileStore = {};
function ensureDir() {
    if (!fs_1.default.existsSync(STORE_DIR))
        fs_1.default.mkdirSync(STORE_DIR, { recursive: true });
}
function loadFileStore() {
    try {
        if (fs_1.default.existsSync(REQUEST_STORE)) {
            const raw = fs_1.default.readFileSync(REQUEST_STORE, 'utf8');
            fileStore = JSON.parse(raw);
        }
    }
    catch (e) {
        fileStore = {};
    }
}
function persistFileStore() {
    try {
        ensureDir();
        fs_1.default.writeFileSync(REQUEST_STORE, JSON.stringify(fileStore, null, 2), 'utf8');
    }
    catch (e) { }
}
loadFileStore();
const ENABLE_REDIS = (process.env.QFLUSH_ENABLE_REDIS === '1' || String(process.env.QFLUSH_ENABLE_REDIS).toLowerCase() === 'true');
const USE_REDIS = ENABLE_REDIS && Boolean(process.env.REDIS_URL);
async function createRequestRecord(idOrMeta, maybeMeta) {
    if (USE_REDIS) {
        const meta = typeof idOrMeta === 'string' ? maybeMeta : idOrMeta;
        const rec = await (0, npz_store_redis_js_1.createRecord)(meta);
        return rec;
    }
    // file mode: if id provided, use it
    let id;
    let meta;
    if (typeof idOrMeta === 'string') {
        id = idOrMeta;
        meta = maybeMeta;
    }
    else {
        id = (idOrMeta && idOrMeta.id) || (Math.random() + '_' + Date.now()).toString();
        meta = idOrMeta || undefined;
    }
    const rec = { id, ts: Date.now(), meta };
    fileStore[id] = rec;
    persistFileStore();
    return rec;
}
async function updateRequestRecord(id, patch) {
    if (USE_REDIS) {
        return await (0, npz_store_redis_js_1.updateRecord)(id, patch);
    }
    if (!fileStore[id])
        return null;
    fileStore[id] = { ...fileStore[id], ...patch };
    persistFileStore();
    return fileStore[id];
}
async function getRequestRecord(id) {
    if (USE_REDIS) {
        return await (0, npz_store_redis_js_1.getRecord)(id);
    }
    return fileStore[id] || null;
}
exports.default = { createRequestRecord, updateRequestRecord, getRequestRecord };
