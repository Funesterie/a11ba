"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPurge = runPurge;
const logger_js_1 = require("../utils/logger.js");
const paths_js_1 = require("../utils/paths.js");
const exec_js_1 = require("../utils/exec.js");
const index_js_1 = require("../supervisor/index.js");
async function runPurge(opts) {
    logger_js_1.logger.info("qflash: purging caches, logs, sessions and supervisor state...");
    const paths = (0, paths_js_1.resolvePaths)(opts?.detected || {});
    const targets = [];
    for (const key of Object.keys(paths)) {
        const p = paths[key];
        if (!p)
            continue;
        targets.push(`${p}/.cache`);
        targets.push(`${p}/logs`);
        targets.push(`${p}/tmp`);
        targets.push(`${p}/sessions`);
    }
    for (const t of targets) {
        try {
            (0, exec_js_1.rimrafSync)(t);
            logger_js_1.logger.success(`Removed ${t}`);
        }
        catch (err) {
            logger_js_1.logger.warn(`Failed to remove ${t}: ${err}`);
        }
    }
    // clear supervisor state
    (0, index_js_1.clearState)();
    logger_js_1.logger.info("Purge complete.");
}
