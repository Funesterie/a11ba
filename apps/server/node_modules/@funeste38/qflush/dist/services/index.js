"use strict";
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
exports.GlobalState = exports.ServiceState = void 0;
exports.listAvailableServices = listAvailableServices;
exports.startService = startService;
exports.stopService = stopService;
exports.enterSleepMode = enterSleepMode;
exports.exitSleepMode = exitSleepMode;
exports.jokerWipe = jokerWipe;
exports.getServiceClients = getServiceClients;
const path_1 = require("path");
const fs = __importStar(require("fs"));
const logger_js_1 = require("../utils/logger.js");
exports.ServiceState = {
    bat: { running: false, lastError: null, lastStart: null },
    spyder: { running: false, lastError: null, lastStart: null },
    nezlephant: { running: false, lastError: null, lastStart: null },
    freeland: { running: false, lastError: null, lastStart: null },
};
exports.GlobalState = { sleep: false };
function tryRequireService(modulePath) {
    try {
        if (fs.existsSync(modulePath)) {
            // require cache-safe
            const mod = require(modulePath);
            return mod;
        }
    }
    catch (e) {
        logger_js_1.logger.warn(`service loader: failed to require ${modulePath}: ${e}`);
    }
    return null;
}
async function makeWrapper(name) {
    // try local dist/<name>/index.js then <name>/dist/index.js then node_modules
    const cand1 = (0, path_1.join)(process.cwd(), name, 'dist', 'index.js');
    const cand2 = (0, path_1.join)(process.cwd(), 'dist', name, 'index.js');
    const cand3 = (0, path_1.join)(process.cwd(), 'node_modules', name, 'dist', 'index.js');
    const m = tryRequireService(cand1) || tryRequireService(cand2) || tryRequireService(cand3);
    if (m) {
        const startFn = (m && (m.start || m.default || m.main)) ? (m.start || m.default || m.main) : null;
        const stopFn = (m && (m.stop)) ? m.stop : undefined;
        if (startFn) {
            return {
                start: async (opts) => {
                    try {
                        await Promise.resolve(startFn(opts));
                    }
                    catch (e) {
                        throw e;
                    }
                },
                stop: stopFn ? async () => Promise.resolve(stopFn()) : undefined,
            };
        }
    }
    // fallback: no embedded API available, provide noop that throws to signal fallback
    return {
        start: async () => {
            throw new Error(`embedded start not available for service ${name}`);
        },
        stop: async () => { },
    };
}
const registry = {};
async function ensureRegistered(name) {
    const key = name.toLowerCase();
    if (!registry[key]) {
        registry[key] = await makeWrapper(key);
    }
    return registry[key];
}
function listAvailableServices() {
    return Object.keys(exports.ServiceState);
}
function ensureQflushDir() {
    const dir = (0, path_1.join)(process.cwd(), '.qflush');
    try {
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
    }
    catch (e) {
        logger_js_1.logger.warn(`[services] ensureQflushDir failed: ${String(e)}`);
    }
    return dir;
}
function persistSafeMode(obj) {
    try {
        const dir = ensureQflushDir();
        const p = (0, path_1.join)(dir, 'safe-modes.json');
        fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
    }
    catch (e) {
        logger_js_1.logger.warn(`failed to persist safe-modes: ${String(e)}`);
    }
}
async function startService(name, opts) {
    const key = String(name || '').toLowerCase();
    if (!exports.ServiceState[key])
        throw new Error(`Unknown service: ${name}`);
    // safe CI mode
    if (process.env.QFLUSH_SAFE_CI === '1') {
        logger_js_1.logger.info(`[SAFE_CI] Skipping service ${key}`);
        return;
    }
    const svc = await ensureRegistered(key);
    try {
        exports.ServiceState[key].lastError = null;
        exports.ServiceState[key].lastStart = Date.now();
        await svc.start(opts);
        exports.ServiceState[key].running = true;
        exports.ServiceState[key].idle = false;
        logger_js_1.logger.info(`[SERVICE] started ${key}`);
    }
    catch (e) {
        exports.ServiceState[key].running = false;
        exports.ServiceState[key].lastError = e;
        logger_js_1.logger.error(`[SERVICE] failed to start ${key}: ${e}`);
        throw e;
    }
}
async function stopService(name) {
    const key = String(name || '').toLowerCase();
    if (!exports.ServiceState[key])
        throw new Error(`Unknown service: ${name}`);
    const svc = await ensureRegistered(key);
    try {
        if (svc.stop)
            await svc.stop();
        exports.ServiceState[key].running = false;
        exports.ServiceState[key].idle = false;
        logger_js_1.logger.info(`[SERVICE] stopped ${key}`);
    }
    catch (e) {
        exports.ServiceState[key].lastError = e;
        logger_js_1.logger.error(`[SERVICE] failed to stop ${key}: ${e}`);
        throw e;
    }
}
function enterSleepMode() {
    logger_js_1.logger.info('[BAT] Sleep mode activated — entering quiet state.');
    exports.GlobalState.sleep = true;
    // mark services idle
    for (const k of Object.keys(exports.ServiceState)) {
        exports.ServiceState[k].idle = true;
    }
    // persist mode
    persistSafeMode({ mode: 'sleep', ts: Date.now() });
}
function exitSleepMode() {
    logger_js_1.logger.info('[BAT] Sleep mode deactivated — resuming normal operations.');
    exports.GlobalState.sleep = false;
    for (const k of Object.keys(exports.ServiceState)) {
        exports.ServiceState[k].idle = false;
    }
    persistSafeMode({ mode: 'normal', ts: Date.now() });
}
async function jokerWipe() {
    logger_js_1.logger.warn('[JOKER] EXPLOSIVE WIPE requested — attempting total cleanup.');
    // attempt graceful stops
    for (const k of Object.keys(exports.ServiceState)) {
        try {
            await stopService(k);
        }
        catch (e) {
            logger_js_1.logger.warn(`[JOKER] stop ${k} failed: ${e}`);
        }
    }
    // kill child processes if any (best-effort)
    try {
        // non-portable: attempt to kill by listing process.children if available
        // fallback: no-op here, supervisor mode would handle SIGKILL
    }
    catch (e) {
        logger_js_1.logger.warn(`[services] attempt to kill child processes failed: ${String(e)}`);
    }
    // clear NPZ storage files and logs
    try {
        const dir = ensureQflushDir();
        const logs = (0, path_1.join)(dir, 'logs');
        if (fs.existsSync(logs)) {
            fs.rmSync(logs, { recursive: true, force: true });
        }
        const active = (0, path_1.join)(dir, 'active-services.json');
        if (fs.existsSync(active))
            fs.unlinkSync(active);
    }
    catch (e) {
        logger_js_1.logger.warn(`[JOKER] cleanup fs failed: ${e}`);
    }
    // persist mode
    persistSafeMode({ mode: 'joker', ts: Date.now() });
    // exit process shortly unless running under tests or explicit test mode
    const isTest = process.env.VITEST === 'true' || process.env.QFLUSH_TEST_MODE === '1';
    if (isTest) {
        logger_js_1.logger.warn('[JOKER] Test mode detected — skipping process.exit');
        return;
    }
    setTimeout(() => {
        logger_js_1.logger.warn('[JOKER] Exiting process (forced).');
        try {
            process.exit(137);
        }
        catch (err) {
            logger_js_1.logger.warn('[services] process.exit failed: ' + String(err));
        }
    }, 300);
}
// Add a small client-facing services provider so cortex/other modules can call non-blocking adapters
function getServiceClients() {
    const clients = {};
    try {
        const a11Adapter = require('../cortex/a11-adapter');
        if (a11Adapter) {
            clients.a11 = {
                ask: async (prompt, opts) => {
                    return a11Adapter.askA11(prompt, opts);
                },
                health: async () => {
                    return a11Adapter.isA11Available();
                }
            };
        }
    }
    catch (e) {
        logger_js_1.logger.info('[SERVICES] no A-11 adapter available: ' + String(e));
    }
    return clients;
}
