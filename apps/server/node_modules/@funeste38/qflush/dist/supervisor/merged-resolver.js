"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMerged = resolveMerged;
const index_js_1 = require("./index.js");
const npz_js_1 = require("../utils/npz.js");
function mergeResults(sup, def) {
    const out = {
        gate: sup.gate,
        cmd: sup.cmd,
        args: sup.args ? [...sup.args] : undefined,
        cwd: sup.cwd,
    };
    if (def) {
        if ((!out.cmd || out.cmd.length === 0) && typeof def.cmd === 'string') {
            out.cmd = def.cmd;
        }
        if ((!out.args || out.args.length === 0) && Array.isArray(def.args)) {
            out.args = [...def.args];
        }
        if ((!out.cwd || out.cwd.length === 0) && typeof def.cwd === 'string') {
            out.cwd = def.cwd;
        }
    }
    return out;
}
async function resolveMerged(profile) {
    const def = await (0, npz_js_1.npzResolve)(profile);
    // 🔒 CI/test mode : superviseur totalement ignoré
    const supervisorDisabled = process.env.QFLUSH_DISABLE_SUPERVISOR === '1' ||
        process.env.QFLUSH_SAFE_CI === '1' ||
        process.env.NODE_ENV === 'test';
    if (supervisorDisabled) {
        return def ?? {
            gate: 'yellow',
            cmd: process.execPath,
            args: undefined,
            cwd: process.cwd(),
        };
    }
    let sup = null;
    try {
        const running = (0, index_js_1.listRunning)();
        // On cherche par name ou cmd
        const found = running.find(r => r.name === profile || r.cmd === profile) ?? null;
        if (found) {
            sup = {
                gate: 'green',
                cmd: found.cmd,
                args: found.args,
                cwd: found.cwd
            };
        }
    }
    catch (err) {
        console.warn('[supervisor] listRunning failed:', err);
        sup = null;
    }
    if (!sup) {
        if (def)
            return def;
        // fallback default when neither supervisor nor npz provide a result
        return {
            gate: 'yellow',
            cmd: process.execPath,
            args: undefined,
            cwd: process.cwd(),
        };
    }
    const merged = mergeResults(sup, def ?? undefined);
    // ensure we always return a usable command
    if (!merged.cmd) {
        merged.cmd = process.execPath;
    }
    return merged;
}
