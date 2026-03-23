"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePackagePath = resolvePackagePath;
exports.readPackageJson = readPackageJson;
const path_1 = require("path");
const fs_1 = require("fs");
const fs_2 = require("fs");
function resolvePackagePath(pkgName) {
    try {
        const resolved = require.resolve(pkgName);
        // walk up to package root
        let dir = resolved;
        while (dir && !(0, fs_1.existsSync)((0, path_1.join)(dir, "package.json"))) {
            const p = require("path").dirname(dir);
            if (p === dir)
                break;
            dir = p;
        }
        if ((0, fs_1.existsSync)((0, path_1.join)(dir, "package.json")))
            return dir;
    }
    catch { }
    // fallback: node_modules path
    const guess = (0, path_1.join)(process.cwd(), "node_modules", pkgName);
    if ((0, fs_1.existsSync)((0, path_1.join)(guess, "package.json")))
        return guess;
    return undefined;
}
function readPackageJson(pkgPath) {
    try {
        const content = (0, fs_2.readFileSync)((0, path_1.join)(pkgPath, "package.json"), "utf8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
