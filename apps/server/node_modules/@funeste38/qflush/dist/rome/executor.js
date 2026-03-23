"use strict";
// ROME-TAG: 0xDE237C
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
exports.executeAction = executeAction;
exports.execCommand = execCommand;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const alias_js_1 = require("../utils/alias.js");
let fetchFn = undefined;
const fetchMod = (0, alias_js_1.importUtil)('../utils/fetch') || (0, alias_js_1.importUtil)('node-fetch');
if (fetchMod)
    fetchFn = fetchMod.default || fetchMod;
if (!fetchFn && typeof globalThis.fetch === 'function')
    fetchFn = globalThis.fetch.bind(globalThis);
let saveEngineHistory;
try {
    saveEngineHistory = require('./storage').saveEngineHistory;
}
catch (e) {
    saveEngineHistory = undefined;
    console.warn('[executor] load storage failed', String(e));
}
// (daemon-control supprimé, ignorer ce module)
let callReload = undefined;
const DEFAULT_CFG = { allowedCommandSubstrings: ['npm', 'node', 'echo'], allowedCommands: ['echo hello', 'npm run build'], commandTimeoutMs: 15000, webhookUrl: '' };
function loadConfig() {
    try {
        const p = path.join(process.cwd(), '.qflush', 'logic-config.json');
        if (fs.existsSync(p))
            return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    catch (e) { }
    return DEFAULT_CFG;
}
// report errors reading config
function _loadConfigSafe() { try {
    return loadConfig();
}
catch (e) {
    console.warn('[executor] loadConfig failed', String(e));
    return DEFAULT_CFG;
} }
function safeExecFile(cmd, cwd, timeoutMs) {
    return new Promise((resolve) => {
        const parts = cmd.split(' ').filter(Boolean);
        if (parts.length === 0)
            return resolve({ code: 1, stdout: '', stderr: 'empty command' });
        // if simple executable with args, prefer execFile
        if (/^[\w@.\-\/\\]+$/.test(parts[0])) {
            const child = (0, child_process_1.execFile)(parts[0], parts.slice(1), { cwd, env: { PATH: process.env.PATH || '' }, timeout: timeoutMs }, (err, stdout, stderr) => {
                if (err && err.code === 'ENOENT') {
                    // fallback to shell when executable not found (e.g. shell built-ins like echo)
                    const sh = (0, child_process_1.spawn)(cmd, { cwd, env: { PATH: process.env.PATH || '' }, shell: true });
                    let out = '';
                    let er = '';
                    sh.stdout?.on('data', (d) => out += d.toString());
                    sh.stderr?.on('data', (d) => er += d.toString());
                    let finished = false;
                    const to = setTimeout(() => { try {
                        sh.kill();
                    }
                    catch (e) {
                        console.warn('[executor] failed to kill fallback shell', String(e));
                    } }, timeoutMs);
                    sh.on('close', (code) => { if (!finished) {
                        finished = true;
                        clearTimeout(to);
                        resolve({ code, stdout: out, stderr: er });
                    } });
                    sh.on('error', (e) => { if (!finished) {
                        finished = true;
                        clearTimeout(to);
                        resolve({ code: 1, stdout: out, stderr: String(e) });
                    } });
                    return;
                }
                if (err && err.code && err.signal === undefined) {
                    resolve({ code: err.code, stdout: stdout?.toString?.() || String(stdout), stderr: stderr?.toString?.() || String(stderr) });
                }
                else if (err) {
                    resolve({ code: 1, stdout: stdout?.toString?.() || String(stdout), stderr: (err && err.message) || String(stderr) });
                }
                else {
                    resolve({ code: 0, stdout: stdout?.toString?.() || String(stdout), stderr: stderr?.toString?.() || String(stderr) });
                }
            });
            return;
        }
        // fallback to shell spawn
        const child = (0, child_process_1.spawn)(cmd, { cwd, env: { PATH: process.env.PATH || '' }, shell: true });
        let out = '';
        let err = '';
        child.stdout.on('data', (d) => out += d.toString());
        child.stderr.on('data', (d) => err += d.toString());
        let finished = false;
        const to = setTimeout(() => { try {
            child.kill();
        }
        catch (e) {
            console.warn('[executor] failed to kill child', String(e));
        } }, timeoutMs);
        child.on('close', (code) => { if (!finished) {
            finished = true;
            clearTimeout(to);
            resolve({ code, stdout: out, stderr: err });
        } });
        child.on('error', (e) => { if (!finished) {
            finished = true;
            clearTimeout(to);
            resolve({ code: 1, stdout: out, stderr: String(e) });
        } });
    });
}
function suspicious(cmd) {
    // reject characters that allow shell expansions redirections or chaining
    return /[;&|<>$`]/.test(cmd);
}
function writeNpzMetadata(record) {
    try {
        const dir = path.join(process.cwd(), '.qflush', 'npz');
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        const idxPath = path.join(dir, 'index.json');
        let idx = {};
        if (fs.existsSync(idxPath)) {
            try {
                idx = JSON.parse(fs.readFileSync(idxPath, 'utf8') || '{}');
            }
            catch (e) {
                idx = {};
                console.warn('[executor] read npz index failed', String(e));
            }
        }
        idx[record.id] = record;
        fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2), 'utf8');
    }
    catch (e) {
        console.warn('[executor] writeNpzMetadata failed', String(e));
    }
}
async function executeAction(action, ctx = {}) {
    const cfg = loadConfig();
    if (!action)
        return { success: false, error: 'empty' };
    try {
        if (action.startsWith('run ')) {
            const m = /run\s+"([^"]+)"(?:\s+in\s+"([^"]+)")?/.exec(action);
            if (!m)
                return { success: false, error: 'invalid run syntax' };
            const cmd = m[1];
            const dir = m[2] ? path.resolve(m[2]) : process.cwd();
            if (suspicious(cmd))
                return { success: false, error: 'command contains suspicious characters' };
            // normalize command for comparison
            const normalizedCmd = String(cmd).trim().replace(/\s+/g, ' ');
            // Robust detection of command name (handles path separators)
            const cmdName = String(normalizedCmd).split(' ')[0].toLowerCase();
            const baseName = cmdName.split(/[\\\/]/).pop() || cmdName;
            const isEcho = baseName === 'echo';
            let allowedByPolicy = false;
            if (isEcho) {
                allowedByPolicy = true;
            }
            // prepare allowedCommands list
            const allowedCommands = Array.isArray(cfg.allowedCommands) ? cfg.allowedCommands.map((c) => String(c).trim().replace(/\s+/g, ' ')) : [];
            // if explicit allowedCommands provided, allow when exact, prefix, or contains match OR when substrings allow it
            if (!allowedByPolicy) {
                if (allowedCommands.length) {
                    const exact = allowedCommands.includes(normalizedCmd);
                    const prefix = allowedCommands.some((ac) => normalizedCmd.startsWith(ac));
                    const contains = allowedCommands.some((ac) => normalizedCmd.includes(ac));
                    if (exact || prefix || contains) {
                        allowedByPolicy = true;
                    }
                    else {
                        const substrings = Array.isArray(cfg.allowedCommandSubstrings) ? cfg.allowedCommandSubstrings : [];
                        const okSub = substrings.some((s) => normalizedCmd.includes(String(s)));
                        if (okSub)
                            allowedByPolicy = true;
                    }
                }
                else {
                    // fallback substring check when no explicit allowedCommands
                    const substrings = Array.isArray(cfg.allowedCommandSubstrings) ? cfg.allowedCommandSubstrings : [];
                    const ok = substrings.some((s) => normalizedCmd.includes(String(s)));
                    if (ok)
                        allowedByPolicy = true;
                }
            }
            if (!allowedByPolicy)
                return { success: false, error: 'command not allowed by policy' };
            if (ctx.dryRun) {
                return { success: true, dryRun: true, cmd };
            }
            const result = await safeExecFile(cmd, dir, cfg.commandTimeoutMs || 15000);
            const res = { success: result.code === 0, stdout: result.stdout, stderr: result.stderr, code: result.code };
            // webhook notify
            if (cfg.webhookUrl && fetchFn) {
                try {
                    await fetchFn(cfg.webhookUrl, { method: 'POST', body: JSON.stringify({ action: cmd, path: ctx.path || null, result: res }), headers: { 'Content-Type': 'application/json' } });
                }
                catch (e) {
                    console.warn('[executor] webhook notify failed', String(e));
                }
            }
            // persist execution history
            try {
                if (saveEngineHistory)
                    saveEngineHistory('exec-' + Date.now(), Date.now(), ctx.path || '', cmd, res);
            }
            catch (e) {
                console.warn('[executor] saveEngineHistory failed', String(e));
            }
            return res;
        }
        if (action.startsWith('npz.encode')) {
            const filePath = ctx.path || 'unknown';
            if (ctx.dryRun) {
                return { success: true, dryRun: true, note: 'would encode ' + filePath };
            }
            const id = 'npz-' + Math.random().toString(36).slice(2, 10);
            const outDir = path.join(process.cwd(), '.qflush', 'npz');
            try {
                if (!fs.existsSync(outDir))
                    fs.mkdirSync(outDir, { recursive: true });
            }
            catch (e) {
                console.warn('[executor] mkdir npz outDir failed', String(e));
            }
            const outFile = path.join(outDir, id + '.bin');
            // write a simple placeholder binary (could be real encoding later)
            try {
                fs.writeFileSync(outFile, Buffer.from(`encoded:${filePath}`));
            }
            catch (e) {
                console.warn('[executor] write npz outFile failed', String(e));
            }
            const metadata = { id, source: filePath, createdAt: new Date().toISOString(), path: outFile };
            writeNpzMetadata(metadata);
            const res = { success: true, id, path: outFile, metadata };
            if (cfg.webhookUrl && fetchFn) {
                try {
                    await fetchFn(cfg.webhookUrl, { method: 'POST', body: JSON.stringify({ action: 'npz.encode', path: filePath, result: res }), headers: { 'Content-Type': 'application/json' } });
                }
                catch (e) {
                    console.warn('[executor] webhook notify npz failed', String(e));
                }
            }
            try {
                if (saveEngineHistory)
                    saveEngineHistory('npz-' + Date.now(), Date.now(), filePath, 'npz.encode', res);
            }
            catch (e) {
                console.warn('[executor] saveEngineHistory npz failed', String(e));
            }
            return res;
        }
        // daemon.reload supprimé, refresh_on_index supprimé
        return { success: false, error: 'unknown action' };
    }
    catch (e) {
        return { success: false, error: e && e.message ? e.message : String(e) };
    }
}
// New helper used by cortex bus to execute a simple command with args
async function execCommand(cmd, args = []) {
    try {
        const command = [cmd, ...(args || [])].join(' ');
        const res = await safeExecFile(command, process.cwd(), loadConfig().commandTimeoutMs || 15000);
        return { code: res.code, stdout: res.stdout, stderr: res.stderr };
    }
    catch (e) {
        return { code: 1, stdout: '', stderr: String(e) };
    }
}
