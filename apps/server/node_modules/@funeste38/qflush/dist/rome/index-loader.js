"use strict";
// ROME-TAG: 0x3BEED1
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
exports.loadRomeIndexFromDisk = loadRomeIndexFromDisk;
exports.getCachedRomeIndex = getCachedRomeIndex;
exports.startRomeIndexAutoRefresh = startRomeIndexAutoRefresh;
exports.onRomeIndexUpdated = onRomeIndexUpdated;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const events_js_1 = require("./events.js");
const INDEX_PATH = path.join(process.cwd(), '.qflush', 'rome-index.json');
let cachedIndex = {};
let lastIndexRaw = '';
function loadRomeIndexFromDisk() {
    try {
        if (!fs.existsSync(INDEX_PATH)) {
            cachedIndex = {};
            return cachedIndex;
        }
        const raw = fs.readFileSync(INDEX_PATH, 'utf8') || '{}';
        // compare raw to detect changes
        const parsed = JSON.parse(raw);
        const old = cachedIndex || {};
        cachedIndex = parsed;
        // emit update if changed
        if (lastIndexRaw && lastIndexRaw !== raw) {
            (0, events_js_1.emitRomeIndexUpdated)(old, cachedIndex);
        }
        lastIndexRaw = raw;
        return cachedIndex;
    }
    catch (e) {
        // on error return empty
        cachedIndex = {};
        return cachedIndex;
    }
}
function getCachedRomeIndex() {
    return cachedIndex;
}
function startRomeIndexAutoRefresh(intervalMs = 30 * 1000) {
    // initial load
    loadRomeIndexFromDisk();
    try {
        setInterval(() => {
            loadRomeIndexFromDisk();
        }, intervalMs).unref();
    }
    catch (e) {
        // ignore
    }
    // start external watcher too
    (0, events_js_1.startIndexWatcher)(Math.max(2000, Math.floor(intervalMs / 10)));
}
function onRomeIndexUpdated(cb) {
    (0, events_js_1.getEmitter)().on('rome.index.updated', cb);
}
