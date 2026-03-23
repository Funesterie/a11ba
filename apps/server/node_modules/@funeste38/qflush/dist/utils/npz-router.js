"use strict";
// ROME-TAG: 0xB3686C
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
exports.DEFAULT_LANES = void 0;
exports.getPreferredLane = getPreferredLane;
exports.setPreferredLane = setPreferredLane;
exports.lanesForHost = lanesForHost;
exports.recordFailure = recordFailure;
exports.recordSuccess = recordSuccess;
exports.isLaneTripped = isLaneTripped;
exports.npzRoute = npzRoute;
exports.getCircuitState = getCircuitState;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const perf_hooks_1 = require("perf_hooks");
const logger_js_1 = require("./logger.js");
const prom_client_1 = __importDefault(require("prom-client"));
const npz_config_js_1 = require("./npz-config.js");
const npz_engine_js_1 = __importDefault(require("./npz-engine.js"));
const NS = (0, npz_config_js_1.getNpzNamespace)();
exports.DEFAULT_LANES = [
    { id: 0, name: 'primary', url: 'https://api.primary.local' },
    { id: 1, name: 'backup-fast', url: 'https://fast.api.local' },
    { id: 2, name: 'backup-slow', url: 'https://slow.api.local' },
];
const STORE_FILE = path.join(process.cwd(), '.qflash', `${NS}-npz-lanes.json`);
const DEFAULT_TIMEOUT = 3000; // ms
const PREFERRED_TTL = 24 * 3600 * 1000; // 24h
// Circuit breaker settings
const FAIL_THRESHOLD = 3; // failures
const FAIL_WINDOW_MS = 60 * 1000; // 1m
const COOLDOWN_MS = 5 * 60 * 1000; // 5m
const circuit = new Map(); // host -> laneId -> state
// Prometheus metrics
const laneSuccess = new prom_client_1.default.Counter({ name: `${NS}_lane_success_total`, help: 'NPZ lane successes', labelNames: ['host', 'lane', 'namespace'] });
const laneFailure = new prom_client_1.default.Counter({ name: `${NS}_lane_failure_total`, help: 'NPZ lane failures', labelNames: ['host', 'lane', 'namespace'] });
function ensureStoreDir() {
    const dir = path.dirname(STORE_FILE);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
}
function readStore() {
    try {
        if (!fs.existsSync(STORE_FILE))
            return {};
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        return JSON.parse(raw);
    }
    catch (err) {
        logger_js_1.logger.warn(`npz-router: failed to read store ${err}`);
        return {};
    }
}
function writeStore(s) {
    try {
        ensureStoreDir();
        fs.writeFileSync(STORE_FILE, JSON.stringify(s, null, 2), 'utf8');
    }
    catch (err) {
        logger_js_1.logger.warn(`npz-router: failed to write store ${err}`);
    }
}
function getPreferredLane(host) {
    const s = readStore();
    const entry = s[host];
    if (!entry)
        return null;
    if (Date.now() - entry.ts > PREFERRED_TTL)
        return null;
    return entry.laneId;
}
function setPreferredLane(host, laneId) {
    const s = readStore();
    s[host] = { laneId, ts: Date.now() };
    writeStore(s);
}
function lanesForHost(host, lanes = exports.DEFAULT_LANES) {
    const pref = getPreferredLane(host);
    // first let engine reorder by score
    const ordered = npz_engine_js_1.default.orderLanesByScore(lanes);
    // then apply preferred lane override
    if (pref === null)
        return ordered.slice();
    const idx = ordered.findIndex((l) => l.id === pref);
    if (idx <= 0)
        return ordered.slice();
    const res = [ordered[idx], ...ordered.slice(0, idx), ...ordered.slice(idx + 1)];
    return res;
}
// Circuit breaker helpers
function getCircuitMapForHost(host) {
    let m = circuit.get(host);
    if (!m) {
        m = new Map();
        circuit.set(host, m);
    }
    return m;
}
function recordFailure(host, laneId, latencyMs) {
    const m = getCircuitMapForHost(host);
    const now = Date.now();
    const st = m.get(laneId) || { failures: 0 };
    if (!st.firstFailureTs || now - (st.firstFailureTs || 0) > FAIL_WINDOW_MS) {
        st.failures = 1;
        st.firstFailureTs = now;
    }
    else {
        st.failures = (st.failures || 0) + 1;
    }
    if (st.failures >= FAIL_THRESHOLD) {
        st.trippedUntil = now + COOLDOWN_MS;
        logger_js_1.logger.warn(`npz-router: lane ${laneId} for ${host} tripped until ${new Date(st.trippedUntil)}`);
    }
    m.set(laneId, st);
    try {
        laneFailure.inc({ host, lane: String(laneId), namespace: NS });
    }
    catch (err) {
        logger_js_1.logger.warn(`npz-router: laneFailure.inc failed: ${err}`);
    }
    try {
        npz_engine_js_1.default.scoreLane(laneId, 1, latencyMs);
    }
    catch (err) {
        logger_js_1.logger.warn(`npz-router: engine.scoreLane failed (failure): ${err}`);
    }
}
function recordSuccess(host, laneId, latencyMs) {
    const m = getCircuitMapForHost(host);
    m.delete(laneId);
    try {
        laneSuccess.inc({ host, lane: String(laneId), namespace: NS });
    }
    catch (err) {
        logger_js_1.logger.warn(`npz-router: laneSuccess.inc failed: ${err}`);
    }
    try {
        npz_engine_js_1.default.scoreLane(laneId, -1, latencyMs);
    }
    catch (err) {
        logger_js_1.logger.warn(`npz-router: engine.scoreLane failed (success): ${err}`);
    }
}
function isLaneTripped(host, laneId) {
    const m = circuit.get(host);
    if (!m)
        return false;
    const st = m.get(laneId);
    if (!st)
        return false;
    if (st.trippedUntil && Date.now() < st.trippedUntil)
        return true;
    // cooldown passed
    if (st.trippedUntil && Date.now() >= st.trippedUntil) {
        m.delete(laneId);
        return false;
    }
    return false;
}
// lightweight fetch wrapper that returns {status, headers, body, durationMs}
async function tryFetch(fullUrl, options = {}, timeout = DEFAULT_TIMEOUT) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const signalOpt = controller ? { signal: controller.signal } : {};
    const opts = { method: options.method || 'GET', headers: options.headers || {}, body: options.body, ...signalOpt };
    let timer = null;
    const start = perf_hooks_1.performance.now();
    if (controller)
        timer = setTimeout(() => controller.abort(), timeout);
    try {
        // prefer global fetch
        let ff = globalThis.fetch;
        if (!ff) {
            try {
                ff = require('undici').fetch;
            }
            catch (e) {
                throw new Error('No fetch available (install undici or use Node 18+)');
            }
        }
        const res = await ff(fullUrl, opts);
        const text = await res.text();
        if (timer)
            clearTimeout(timer);
        const duration = Math.max(0, Math.round(perf_hooks_1.performance.now() - start));
        return { ok: true, status: res.status, headers: res.headers, body: text, durationMs: duration };
    }
    catch (err) {
        if (timer)
            clearTimeout(timer);
        const duration = Math.max(0, Math.round(perf_hooks_1.performance.now() - start));
        return { ok: false, error: err, durationMs: duration };
    }
}
async function npzRoute(req, lanes = exports.DEFAULT_LANES) {
    try {
        const urlObj = new URL(req.url);
        const host = urlObj.host;
        const ordered = lanesForHost(host);
        // attempt primary
        const primary = ordered[0];
        const primaryUrl = req.url.replace(urlObj.origin, primary.url);
        const timeout = req.timeout || DEFAULT_TIMEOUT;
        logger_js_1.logger.info(`NPZ attempting primary lane ${primary.name} -> ${primaryUrl}`);
        const t0 = await tryFetch(primaryUrl, { method: req.method, headers: req.headers, body: req.body }, timeout);
        if (t0.ok && t0.status && t0.status < 500) {
            logger_js_1.logger.info(`NPZ primary succeeded (${primary.name})`);
            setPreferredLane(host, primary.id);
            recordSuccess(host, primary.id, t0.durationMs);
            return { status: t0.status, headers: t0.headers, body: t0.body, gate: 'primary', laneId: primary.id, durationMs: t0.durationMs };
        }
        // primary failed -> try fallback(s)
        logger_js_1.logger.warn(`[NPZ] primary failed for ${primary.name}, running fallbacks`);
        recordFailure(host, primary.id, t0.durationMs);
        for (let i = 1; i < ordered.length; i++) {
            const lane = ordered[i];
            const laneUrl = req.url.replace(urlObj.origin, lane.url);
            logger_js_1.logger.info(`NPZ trying fallback lane ${lane.name} -> ${laneUrl}`);
            const res = await tryFetch(laneUrl, { method: req.method, headers: req.headers, body: req.body }, timeout);
            if (res.ok && res.status && res.status < 500) {
                logger_js_1.logger.info(`NPZ fallback lane ${lane.name} succeeded`);
                // set preferred to fallback for next time
                setPreferredLane(host, lane.id);
                recordSuccess(host, lane.id, res.durationMs);
                // replay primary with an extra header (T2)
                const replayHeaders = Object.assign({}, req.headers || {});
                replayHeaders['X-NPZ-FALLBACK'] = '1';
                const replayUrl = primaryUrl;
                logger_js_1.logger.info(`NPZ replaying primary (${primary.name}) with fallback header`);
                const replay = await tryFetch(replayUrl, { method: req.method, headers: replayHeaders, body: req.body }, timeout);
                if (replay.ok && replay.status && replay.status < 500) {
                    logger_js_1.logger.info(`NPZ replayed primary succeeded after fallback`);
                    return { status: replay.status, headers: replay.headers, body: replay.body, gate: 'replay', laneId: primary.id, durationMs: replay.durationMs };
                }
                // if replay failed, return fallback result
                return { status: res.status, headers: res.headers, body: res.body, gate: 'fallback', laneId: lane.id, durationMs: res.durationMs };
            }
            else {
                recordFailure(host, lane.id, res.durationMs);
            }
        }
        // if all failed, return primary error or generic
        logger_js_1.logger.warn('[NPZ] all lanes failed');
        if (t0 && !t0.ok)
            return { error: t0.error, gate: 'fail', durationMs: t0.durationMs };
        return { status: t0.status, body: t0.body, gate: 'fail', durationMs: t0.durationMs };
    }
    catch (err) {
        return { error: err, gate: 'error' };
    }
}
function getCircuitState(host) {
    const m = circuit.get(host);
    if (!m)
        return {};
    const out = {};
    for (const [k, v] of m.entries())
        out[k] = v;
    return out;
}
exports.default = { DEFAULT_LANES: exports.DEFAULT_LANES, npzRoute, getPreferredLane, setPreferredLane, lanesForHost, recordFailure, recordSuccess, isLaneTripped, getCircuitState };
