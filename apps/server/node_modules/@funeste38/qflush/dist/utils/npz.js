"use strict";
// ROME-TAG: 0x1553F0
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
exports.npzResolve = npzResolve;
exports.runResolved = runResolved;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const logger_js_1 = require("./logger.js");
const paths_js_1 = require("./paths.js");
function isWindows() {
    return process.platform === 'win32';
}
function findLocalBin(moduleName, cwd) {
    // try node_modules/.bin/<name> or <pkg>/bin
    const localBin = path.join(cwd, 'node_modules', '.bin', moduleName + (isWindows() ? '.cmd' : ''));
    if ((0, fs_1.existsSync)(localBin))
        return localBin;
    // try package bin entry via require.resolve
    try {
        const pkgPath = require.resolve(moduleName, { paths: [cwd] });
        return pkgPath;
    }
    catch (error_) {
        logger_js_1.logger.warn && logger_js_1.logger.warn(`[NPZ] findLocalBin.resolve failed for ${moduleName}: ${String(error_)}`);
        return null;
    }
}
function resolveViaModuleGate(pkgName) {
    try {
        const pkgPath = require.resolve(pkgName);
        // run via node <pkgPath>
        return { cmd: process.execPath, args: [pkgPath], cwd: path.dirname(pkgPath) };
    }
    catch (error_) {
        logger_js_1.logger.warn && logger_js_1.logger.warn(`[NPZ] resolveViaModuleGate failed for ${pkgName}: ${String(error_)}`);
        return null;
    }
}
function npzResolve(nameOrPkg, opts = {}) {
    const cwd = opts.cwd || process.cwd();
    // Gate 0: if nameOrPkg matches a known SERVICE_MAP package, prefer local candidates in workspace
    try {
        for (const key of Object.keys(paths_js_1.SERVICE_MAP)) {
            if (paths_js_1.SERVICE_MAP[key].pkg === nameOrPkg) {
                const tries = paths_js_1.SERVICE_MAP[key].candidates || [];
                for (const t of tries) {
                    const candidatePath = path.join(cwd, t);
                    try {
                        if (!(0, fs_1.existsSync)(candidatePath))
                            continue;
                        // prefer dist entry if exists
                        const distEntry = path.join(candidatePath, 'dist', 'index.js');
                        if ((0, fs_1.existsSync)(distEntry)) {
                            logger_js_1.logger.info && logger_js_1.logger.info(`[NPZ:JOKER] ${nameOrPkg} -> local dist ${distEntry}`);
                            return { gate: 'green', cmd: process.execPath, args: [distEntry], cwd: path.dirname(distEntry) };
                        }
                        // otherwise if package.json with start script exists, prefer npm --prefix <candidate> run start
                        const pkgJsonPath = path.join(candidatePath, 'package.json');
                        if ((0, fs_1.existsSync)(pkgJsonPath)) {
                            try {
                                const pj = require(pkgJsonPath);
                                if (pj && pj.scripts && pj.scripts.start) {
                                    logger_js_1.logger.info && logger_js_1.logger.info(`[NPZ:JOKER] ${nameOrPkg} -> local start script at ${candidatePath}`);
                                    return { gate: 'green', cmd: 'npm', args: ['--prefix', candidatePath, 'run', 'start'], cwd: candidatePath };
                                }
                            }
                            catch (error_) {
                                logger_js_1.logger.warn && logger_js_1.logger.warn(`[NPZ] failed to read package.json at ${pkgJsonPath}: ${String(error_)}`);
                            }
                        }
                    }
                    catch (error_) {
                        logger_js_1.logger.warn && logger_js_1.logger.warn(`[NPZ] candidate check failed for ${candidatePath}: ${String(error_)}`);
                    }
                }
                break;
            }
        }
    }
    catch (error_) {
        logger_js_1.logger.warn && logger_js_1.logger.warn(`[NPZ] SERVICE_MAP gate failed: ${String(error_)}`);
    }
    // Gate 1: GREEN - local bin
    const local = findLocalBin(nameOrPkg, cwd);
    if (local) {
        logger_js_1.logger.info && logger_js_1.logger.info(`[NPZ:JOKER] ${nameOrPkg} -> ${local}`);
        return { gate: 'green', cmd: local, args: [], cwd };
    }
    // Gate 2: YELLOW - module resolution
    const mod = resolveViaModuleGate(nameOrPkg);
    if (mod) {
        logger_js_1.logger.info && logger_js_1.logger.info(`[NPZ:JOKER] ${nameOrPkg} -> ${mod.cmd} ${mod.args.join(' ')}`);
        return { gate: 'yellow', cmd: mod.cmd, args: mod.args, cwd: mod.cwd };
    }
    // Gate 3: DLX - use npm exec as modern fallback, fallback to npx if needed
    try {
        // prefer `npm exec -- <pkg>` which is the modern replacement for npx (npm v7+)
        // This will allow running installed or remote packages consistently.
        logger_js_1.logger.info && logger_js_1.logger.info(`[NPZ:JOKER] ${nameOrPkg} -> npm exec`);
        return { gate: 'dlx', cmd: 'npm', args: ['exec', '--', nameOrPkg], cwd };
    }
    catch (error_) {
        // last-resort: npx
        try {
            logger_js_1.logger.info && logger_js_1.logger.info(`[NPZ:JOKER] ${nameOrPkg} -> npx`);
            return { gate: 'dlx', cmd: 'npx', args: [nameOrPkg], cwd };
        }
        catch (error2) {
            logger_js_1.logger.warn && logger_js_1.logger.warn(`[NPZ:JOKER][FAIL] ${nameOrPkg} cannot be resolved: ${String(error2)}`);
            return { gate: 'fail' };
        }
    }
}
function runResolved(res) {
    if (!res.cmd)
        return { ok: false };
    const args = res.args || [];
    logger_js_1.logger.info && logger_js_1.logger.info(`running ${res.cmd} ${args.join(' ')}`);
    try {
        const r = (0, child_process_1.spawnSync)(res.cmd, args, { stdio: 'inherit', cwd: res.cwd || process.cwd(), shell: false });
        return { ok: r.status === 0, status: r.status ?? undefined };
    }
    catch (error_) {
        logger_js_1.logger.error && logger_js_1.logger.error(`[NPZ:JOKER] failed to run ${String(error_)}`);
        return { ok: false };
    }
}
exports.default = { npzResolve, runResolved };
