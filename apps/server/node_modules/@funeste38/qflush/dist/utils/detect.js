"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectModules = detectModules;
exports.findAndKill = findAndKill;
const child_process_1 = require("child_process");
const logger_js_1 = require("./logger.js");
const paths_js_1 = require("./paths.js");
const package_js_1 = require("./package.js");
async function detectModules() {
    const out = {};
    for (const name of Object.keys(paths_js_1.SERVICE_MAP))
        out[name] = { running: false, installed: false, path: undefined, bin: undefined };
    for (const name of Object.keys(paths_js_1.SERVICE_MAP)) {
        try {
            const pkgPath = (0, package_js_1.resolvePackagePath)(paths_js_1.SERVICE_MAP[name].pkg);
            if (pkgPath) {
                out[name].installed = true;
                out[name].path = pkgPath;
                try {
                    const pkgJson = require(require('path').join(pkgPath, 'package.json'));
                    if (pkgJson && pkgJson.bin) {
                        out[name].bin = typeof pkgJson.bin === 'string' ? pkgJson.bin : Object.values(pkgJson.bin)[0];
                    }
                }
                catch { }
            }
        }
        catch { }
    }
    await new Promise((resolve) => {
        (0, child_process_1.exec)(process.platform === "win32" ? "tasklist" : "ps aux", (err, stdout) => {
            if (err) {
                logger_js_1.logger.warn(`Failed to list processes: ${err.message}`);
                return resolve();
            }
            const s = stdout.toString();
            for (const name of Object.keys(paths_js_1.SERVICE_MAP)) {
                const regex = new RegExp(name, "i");
                if (regex.test(s)) {
                    out[name].running = true;
                }
            }
            resolve();
        });
    });
    return out;
}
async function findAndKill() {
    const names = Object.keys(paths_js_1.SERVICE_MAP);
    const killed = [];
    for (const n of names) {
        try {
            if (process.platform === "win32") {
                (0, child_process_1.exec)(`taskkill /IM ${n}.exe /F`, (err) => { });
            }
            else {
                (0, child_process_1.exec)(`pkill -f ${n}`, (err) => { });
            }
        }
        catch (err) {
            // ignore
        }
    }
    return killed;
}
