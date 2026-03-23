"use strict";
// ROME-TAG: 0xA11A11
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
exports.default = runA11;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const gandalf_light_1 = require("../core/gandalf-light");
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
const CFG_PATH = path.join(process.cwd(), '.qflush', 'a11.config.json');
function loadCfg() {
    try {
        if (!fs.existsSync(CFG_PATH))
            return null;
        return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
    }
    catch (e) {
        return null;
    }
}
async function runA11(argv = []) {
    (0, gandalf_light_1.whiteLight)('daemon.start', { phase: 'a11-init', argv });
    const sub = argv[0] || 'status';
    const cfg = loadCfg();
    if (!cfg || !cfg.enabled) {
        (0, gandalf_light_1.whiteLight)('fs.test', { file: 'a11.config.json', found: false });
        console.log('A-11 not enabled or not configured (see .qflush/a11.config.json)');
        return 0;
    }
    (0, gandalf_light_1.whiteLight)('fs.test', { file: 'a11.config.json', found: true });
    if (sub === 'start') {
        if (!cfg.startCommand) {
            console.error('no startCommand configured for A-11');
            return 1;
        }
        try {
            const parts = cfg.startCommand.split(' ');
            const proc = (0, child_process_1.spawn)(parts[0], parts.slice(1), { cwd: cfg.path || process.cwd(), detached: true, stdio: 'ignore', shell: true });
            proc.unref();
            if (cfg.pidFile)
                fs.writeFileSync(cfg.pidFile, String(proc.pid), 'utf8');
            (0, gandalf_light_1.whiteLight)('daemon.start', { phase: 'a11-start', pid: proc.pid });
            console.log('A-11 start invoked (detached).');
            return 0;
        }
        catch (e) {
            console.error('failed to start A-11:', String(e));
            return 1;
        }
    }
    if (sub === 'stop') {
        if (cfg.pidFile && fs.existsSync(cfg.pidFile)) {
            try {
                const pid = Number(fs.readFileSync(cfg.pidFile, 'utf8'));
                try {
                    process.kill(pid);
                }
                catch (e) {
                    console.warn('[a11] process.kill failed', String(e));
                }
                try {
                    fs.unlinkSync(cfg.pidFile);
                }
                catch (e) {
                    console.warn('[a11] unlink pidFile failed', String(e));
                }
                (0, gandalf_light_1.whiteLight)('daemon.start', { phase: 'a11-stop', pid });
                console.log('A-11 stop requested (pid ' + pid + ').');
                return 0;
            }
            catch (e) {
                console.error('failed to stop A-11', String(e));
                return 1;
            }
        }
        console.log('no pidFile for A-11; cannot stop cleanly');
        return 0;
    }
    // status
    if (cfg.healthUrl) {
        try {
            const fetch = await resolveFetch();
            if (!fetch)
                throw new Error('fetch not available');
            const res = await fetch(cfg.healthUrl, { method: 'GET' });
            if (res.ok) {
                console.log('A-11 healthy');
                return 0;
            }
            console.log('A-11 unhealthy, status', res.status);
            return 2;
        }
        catch (e) {
            console.log('A-11 health check failed:', String(e));
            return 3;
        }
    }
    // fallback: check pid
    if (cfg.pidFile && fs.existsSync(cfg.pidFile)) {
        try {
            const pid = Number(fs.readFileSync(cfg.pidFile, 'utf8'));
            try {
                process.kill(pid, 0);
                (0, gandalf_light_1.whiteLight)('daemon.start', { phase: 'a11-running', pid });
                console.log('A-11 running (pid', pid + ')');
                return 0;
            }
            catch (e) {
                console.log('A-11 not running');
                return 3;
            }
        }
        catch (e) {
            console.log('A-11 check failed', String(e));
            return 3;
        }
    }
    console.log('A-11 not running (no healthUrl or pidFile)');
    (0, gandalf_light_1.whiteLight)('daemon.start', { phase: 'a11-not-running' });
    return 3;
}
