"use strict";
// ROME-TAG: 0xF2B208
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
exports.initCopilotBridge = initCopilotBridge;
exports.emitEngineState = emitEngineState;
exports.emitRuleEvent = emitRuleEvent;
exports.emitDiagnostic = emitDiagnostic;
exports.onTelemetry = onTelemetry;
exports.shutdownCopilotBridge = shutdownCopilotBridge;
exports.getConfig = getConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const events_1 = require("events");
const storage_js_1 = require("./storage.js");
async function resolveFetch() {
    if (typeof globalThis.fetch === 'function')
        return globalThis.fetch;
    try {
        const m = await import('node-fetch');
        return (m && m.default) || m;
    }
    catch (e) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const undici = require('undici');
            if (undici && typeof undici.fetch === 'function')
                return undici.fetch;
        }
        catch (_) { }
    }
    return undefined;
}
const DEFAULT_CONFIG = {
    enabled: false,
    telemetryVersion: 1,
    transports: ['file'],
    filePath: '.qflush/telemetry.json',
    allowedData: ['engineState', 'ruleEvent', 'diagnostic', 'contextSnapshot'],
    samplingRate: 1.0,
    maxPayloadSize: 200000
};
let cfg = DEFAULT_CONFIG;
const emitter = new events_1.EventEmitter();
// Respect environment flags to forcibly disable Copilot/telemetry
const ENV_DISABLE_COPILOT = process.env.QFLUSH_DISABLE_COPILOT === '1' ||
    String(process.env.QFLUSH_DISABLE_COPILOT).toLowerCase() === 'true' ||
    process.env.QFLUSH_TELEMETRY === '0';
function loadCfg() {
    try {
        const p = path.join(process.cwd(), '.qflush', 'copilot.json');
        if (fs.existsSync(p)) {
            const raw = fs.readFileSync(p, 'utf8');
            cfg = Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw));
        }
        else {
            cfg = Object.assign({}, DEFAULT_CONFIG);
        }
    }
    catch (e) {
        cfg = Object.assign({}, DEFAULT_CONFIG);
    }
    if (ENV_DISABLE_COPILOT) {
        cfg.enabled = false;
    }
}
async function sendWebhook(event) {
    if (!cfg.enabled)
        return;
    if (!cfg.webhookUrl)
        return;
    try {
        const payload = JSON.stringify(event);
        const headers = { 'Content-Type': 'application/json' };
        const fetch = await resolveFetch();
        if (!fetch)
            return;
        await fetch(cfg.webhookUrl, { method: 'POST', body: payload, headers });
    }
    catch (e) {
        // best-effort
    }
}
function writeFileEvent(event) {
    try {
        if (!cfg.enabled)
            return;
        const p = path.join(process.cwd(), cfg.filePath || '.qflush/telemetry.json');
        const dir = path.dirname(p);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        const tmp = p + '.tmp';
        const arr = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8') || '[]') : [];
        arr.push(event);
        fs.writeFileSync(tmp, JSON.stringify(arr, null, 2), 'utf8');
        fs.renameSync(tmp, p);
    }
    catch (e) {
        // ignore
    }
}
function initCopilotBridge() {
    loadCfg();
    if (!cfg.enabled)
        return;
}
async function emitEngineState(state) {
    if (!cfg.enabled)
        return;
    const ev = { type: 'engine_state', telemetryVersion: cfg.telemetryVersion, timestamp: new Date().toISOString(), payload: state };
    if (cfg.transports.includes('webhook'))
        await sendWebhook(ev);
    if (cfg.transports.includes('file'))
        writeFileEvent(ev);
    try {
        (0, storage_js_1.saveTelemetryEvent)('engine-' + Date.now(), 'engine_state', Date.now(), state);
    }
    catch (e) { }
    emitter.emit('telemetry', ev);
}
async function emitRuleEvent(ev) {
    if (!cfg.enabled)
        return;
    const event = { type: 'rule_event', telemetryVersion: cfg.telemetryVersion, timestamp: new Date().toISOString(), payload: ev };
    if (cfg.transports.includes('webhook'))
        await sendWebhook(event);
    if (cfg.transports.includes('file'))
        writeFileEvent(event);
    try {
        (0, storage_js_1.saveTelemetryEvent)('rule-' + Date.now(), 'rule_event', Date.now(), ev);
    }
    catch (e) { }
    emitter.emit('telemetry', event);
}
async function emitDiagnostic(diag) {
    if (!cfg.enabled)
        return;
    const event = { type: 'diagnostic', telemetryVersion: cfg.telemetryVersion, timestamp: new Date().toISOString(), payload: diag };
    if (cfg.transports.includes('webhook'))
        await sendWebhook(event);
    if (cfg.transports.includes('file'))
        writeFileEvent(event);
    try {
        (0, storage_js_1.saveTelemetryEvent)('diag-' + Date.now(), 'diagnostic', Date.now(), diag);
    }
    catch (e) { }
    emitter.emit('telemetry', event);
}
function onTelemetry(cb) { emitter.on('telemetry', cb); }
function shutdownCopilotBridge() { }
function getConfig() { return cfg; }
