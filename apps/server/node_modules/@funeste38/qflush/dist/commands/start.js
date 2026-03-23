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
exports.runStart = runStart;
const detect_js_1 = require("../utils/detect.js");
const logger_js_1 = require("../utils/logger.js");
const exec_js_1 = require("../utils/exec.js");
const paths_js_1 = require("../utils/paths.js");
const package_js_1 = require("../utils/package.js");
const index_js_1 = require("../supervisor/index.js");
const health_js_1 = require("../utils/health.js");
const path = __importStar(require("node:path"));
let config = {};
function getRunCommand(pkgJson, pkgPath, pkg, mod) {
    if (pkgJson?.bin) {
        const binEntry = typeof pkgJson.bin === "string" ? pkgJson.bin : Object.values(pkgJson.bin)[0];
        const binPath = path.join(pkgPath, binEntry);
        if (binPath.endsWith(".js") && (0, exec_js_1.pathExists)(binPath)) {
            return { cmd: process.execPath, args: [binPath], cwd: pkgPath };
        }
        if ((0, exec_js_1.pathExists)(binPath)) {
            return { cmd: binPath, args: [], cwd: pkgPath };
        }
        logger_js_1.logger.warn(`${mod} bin entry not found at ${binPath}. ${(0, exec_js_1.rebuildInstructionsFor)(pkgPath)}`);
        return null;
    }
    if (pkg) {
        logger_js_1.logger.warn(`${mod} has no local bin; will run via npx which may fail if package not globally installed.`);
        return { cmd: "npx", args: [pkg], cwd: process.cwd() };
    }
    return null;
}
async function launchModule(mod, opts, paths, flags, waitForStart) {
    const p = opts?.modulePaths?.[mod] ?? paths?.[mod];
    const pkg = paths_js_1.SERVICE_MAP?.[mod]?.pkg;
    let pkgPath = p || (pkg ? (0, package_js_1.resolvePackagePath)(pkg) : "");
    if (!pkgPath && pkg) {
        if (!(0, exec_js_1.ensurePackageInstalled)(pkg)) {
            logger_js_1.logger.warn(`${mod} not found and failed to install ${pkg}, skipping`);
            return;
        }
        pkgPath = (0, package_js_1.resolvePackagePath)(pkg);
    }
    if (!pkgPath) {
        logger_js_1.logger.warn(`${mod} path and package not found, skipping`);
        return;
    }
    const pkgJson = (0, package_js_1.readPackageJson)(pkgPath);
    const runCmd = getRunCommand(pkgJson, pkgPath, pkg, mod);
    if (!runCmd) {
        logger_js_1.logger.warn(`${mod} has no runnable entry, skipping`);
        return;
    }
    logger_js_1.logger.info(`Launching ${mod} -> ${runCmd.cmd} ${runCmd.args.join(" ")}`);
    (0, index_js_1.startProcess)(mod, runCmd.cmd, runCmd.args, { cwd: runCmd.cwd });
    if (waitForStart) {
        await handleHealthCheck(mod, flags);
    }
}
async function handleHealthCheck(mod, flags) {
    const svcUrl = flags["health-url"] ?? flags["health"];
    let svcPort = undefined;
    if (typeof flags["health-port"] === "string") {
        const parsed = Number.parseInt(flags["health-port"], 10);
        svcPort = Number.isNaN(parsed) ? undefined : parsed;
    }
    else if (typeof flags["health-port"] === "number") {
        svcPort = flags["health-port"];
    }
    if (svcUrl) {
        const ok = await (0, health_js_1.waitForService)(svcUrl, svcPort);
        if (ok)
            logger_js_1.logger.success(`${mod} passed health check`);
        else
            logger_js_1.logger.warn(`${mod} failed health check`);
    }
    else {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        logger_js_1.logger.info(`${mod} started (delayed wait).`);
    }
}
async function runStart(opts) {
    logger_js_1.logger.info("qflash: starting modules...");
    const detected = opts?.detected ?? (await (0, detect_js_1.detectModules)());
    // Filtrer les paths undefined pour respecter Record<string, string>
    const rawPaths = (0, paths_js_1.resolvePaths)(detected);
    const paths = Object.fromEntries(Object.entries(rawPaths)
        .filter(([_, v]) => typeof v === "string")
        .map(([k, v]) => [k, v]));
    const services = opts?.services?.length ? opts.services : Object.keys(paths_js_1.SERVICE_MAP);
    const flags = opts?.flags ?? {};
    const waitForStart = Boolean(flags["wait"] ?? flags["--wait"] ?? false);
    await Promise.all(services.map((mod) => launchModule(mod, opts, paths, flags, waitForStart)));
    logger_js_1.logger.success("qflash: start sequence initiated for selected modules");
}
