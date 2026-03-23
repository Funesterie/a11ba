"use strict";
// ROME-TAG: 0x096E30
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
exports.getEmitter = getEmitter;
exports.startIndexWatcher = startIndexWatcher;
exports.emitRomeIndexUpdated = emitRomeIndexUpdated;
const events_1 = require("events");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const emitter = new events_1.EventEmitter();
const INDEX_PATH = path.join(process.cwd(), '.qflush', 'rome-index.json');
let lastStatMs = 0;
function getEmitter() { return emitter; }
function startIndexWatcher(intervalMs = 5000) {
    try {
        if (!fs.existsSync(INDEX_PATH))
            return;
        // simple poll to avoid fs.watch platform issues
        setInterval(() => {
            try {
                const st = fs.statSync(INDEX_PATH);
                if (st.mtimeMs > lastStatMs) {
                    lastStatMs = st.mtimeMs;
                    // load file
                    const raw = fs.readFileSync(INDEX_PATH, 'utf8') || '{}';
                    let json = {};
                    try {
                        json = JSON.parse(raw);
                    }
                    catch (e) {
                        json = {};
                    }
                    emitter.emit('rome.index.file.changed', { path: INDEX_PATH, index: json });
                }
            }
            catch (e) {
                // ignore
            }
        }, intervalMs).unref();
    }
    catch (e) {
        // ignore
    }
}
function emitRomeIndexUpdated(oldIndex, newIndex) {
    // compute changed paths: tag changed or new/removed
    const changed = [];
    const all = new Set([...Object.keys(oldIndex || {}), ...Object.keys(newIndex || {})]);
    for (const k of all) {
        const a = oldIndex && oldIndex[k];
        const b = newIndex && newIndex[k];
        if (!a && b) {
            changed.push(k);
            continue;
        }
        if (a && !b) {
            changed.push(k);
            continue;
        }
        if (a && b) {
            if (a.tag !== b.tag)
                changed.push(k);
        }
    }
    emitter.emit('rome.index.updated', { oldIndex, newIndex, changedPaths: changed });
}
