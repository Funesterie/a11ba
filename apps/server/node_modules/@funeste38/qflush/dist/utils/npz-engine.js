"use strict";
// ROME-TAG: 0x043BA9
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
exports.scoreLane = scoreLane;
exports.getLaneScore = getLaneScore;
exports.orderLanesByScore = orderLanesByScore;
exports.resetScores = resetScores;
exports.getStore = getStore;
const npz_config_js_1 = require("./npz-config.js");
const fs_1 = __importDefault(require("fs"));
const path = __importStar(require("path"));
const NS = (0, npz_config_js_1.getNpzNamespace)();
const ENGINE_FILE = path.join(process.cwd(), '.qflush', `${NS}-npz-engine.json`);
let store = {};
// decay parameters
const DECAY_INTERVAL_MS = 60 * 1000; // every minute
const DECAY_FACTOR = 0.9; // multiply score by this every decay interval (towards 0)
function ensureDir() {
    const dir = path.dirname(ENGINE_FILE);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
}
function load() {
    try {
        if (fs_1.default.existsSync(ENGINE_FILE)) {
            const raw = fs_1.default.readFileSync(ENGINE_FILE, 'utf8');
            store = JSON.parse(raw);
        }
    }
    catch (e) {
        store = {};
        console.warn('[npz-engine] load failed, starting with empty store', String(e));
    }
}
function persist() {
    try {
        ensureDir();
        fs_1.default.writeFileSync(ENGINE_FILE, JSON.stringify(store, null, 2), 'utf8');
    }
    catch (e) {
        console.warn('[npz-engine] persist failed', String(e));
    }
}
function applyDecay() {
    const now = Date.now();
    let changed = false;
    for (const k of Object.keys(store)) {
        const id = Number(k);
        const rec = store[id];
        if (!rec)
            continue;
        // compute how many intervals since lastSuccess/lastFailure (use lastFailure as activity reference)
        const ref = rec.lastFailure || rec.lastSuccess || now;
        const intervals = Math.floor((now - ref) / DECAY_INTERVAL_MS);
        if (intervals <= 0)
            continue;
        const factor = Math.pow(DECAY_FACTOR, intervals);
        const newScore = rec.score * factor;
        if (Math.abs(newScore - rec.score) > 1e-6) {
            rec.score = newScore;
            changed = true;
        }
    }
    if (changed)
        persist();
}
load();
// schedule periodic decay in-memory (best-effort)
setInterval(() => {
    try {
        applyDecay();
    }
    catch (e) {
        console.warn('[npz-engine] applyDecay errored', String(e));
    }
}, DECAY_INTERVAL_MS);
/**
 * Adjust lane score.
 * delta: positive increases penalty (worse), negative decreases (better).
 * latencyMs: optional latency observed to weight the delta.
 */
function scoreLane(laneId, delta, latencyMs) {
    let rec = store[laneId];
    if (!rec)
        rec = { laneId, score: 0 };
    // weight delta by latency (if provided): normalized over 1000ms
    let weight = 1;
    if (latencyMs && latencyMs > 0)
        weight += Math.min(5, latencyMs / 1000); // cap weight
    rec.score = (rec.score || 0) + delta * weight;
    if (delta < 0)
        rec.lastSuccess = Date.now();
    if (delta > 0)
        rec.lastFailure = Date.now();
    store[laneId] = rec;
    persist();
}
function getLaneScore(laneId) {
    const rec = store[laneId];
    if (!rec)
        return 0;
    // apply decay relative to now on read (non-persistent)
    const now = Date.now();
    const ref = rec.lastFailure || rec.lastSuccess || now;
    const intervals = Math.floor((now - ref) / DECAY_INTERVAL_MS);
    const factor = Math.pow(DECAY_FACTOR, intervals);
    return rec.score * factor;
}
function orderLanesByScore(lanes) {
    // return copy sorted by score asc
    const out = lanes.slice();
    out.sort((a, b) => getLaneScore(a.id) - getLaneScore(b.id));
    return out;
}
function resetScores() {
    store = {};
    persist();
}
function getStore() {
    return store;
}
exports.default = { scoreLane, getLaneScore, orderLanesByScore, resetScores, getStore };
