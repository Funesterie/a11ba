"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnSafe = spawnSafe;
exports.rimrafSync = rimrafSync;
exports.isPackageInstalled = isPackageInstalled;
exports.ensurePackageInstalled = ensurePackageInstalled;
exports.pathExists = pathExists;
exports.rebuildInstructionsFor = rebuildInstructionsFor;
const child_process_1 = require("child_process");
const logger_js_1 = require("./logger.js");
const fs_1 = require("fs");
const child_process_2 = require("child_process");
function spawnSafe(command, args = [], opts = {}) {
    try {
        const proc = (0, child_process_1.spawn)(command, args, { stdio: "inherit", shell: true, ...opts });
        proc.on("error", (err) => logger_js_1.logger.error(`Process error: ${err.message}`));
        return proc;
    }
    catch (err) {
        logger_js_1.logger.error(`Failed to spawn ${command}: ${err.message}`);
        throw err;
    }
}
function rimrafSync(path) {
    if (!path)
        return;
    if (!(0, fs_1.existsSync)(path))
        return;
    try {
        (0, fs_1.rmSync)(path, { recursive: true, force: true });
    }
    catch (err) {
        // fallback
        try {
            (0, fs_1.unlinkSync)(path);
        }
        catch { }
    }
}
function isPackageInstalled(pkgName) {
    try {
        (0, child_process_2.execSync)(`npm ls ${pkgName} --depth=0`, { stdio: "ignore" });
        return true;
    }
    catch {
        return false;
    }
}
function ensurePackageInstalled(pkgName) {
    if (isPackageInstalled(pkgName))
        return true;
    logger_js_1.logger.info(`Installing missing package ${pkgName}...`);
    try {
        (0, child_process_2.execSync)(`npm install -g ${pkgName}`, { stdio: "inherit" });
        return true;
    }
    catch (err) {
        logger_js_1.logger.warn(`Failed to install ${pkgName}: ${err.message}`);
        return false;
    }
}
// Helpers for CLI pre-launch checks
function pathExists(pathStr) {
    return !!pathStr && (0, fs_1.existsSync)(pathStr);
}
function rebuildInstructionsFor(pkgPath) {
    if (!pkgPath)
        return `Rebuild the package (cd <pkg> && npm install && npm run build && npm install -g .)`;
    return `Rebuild the package:\n  cd ${pkgPath}\n  npm install\n  npm run build\n  npm install -g .`;
}
