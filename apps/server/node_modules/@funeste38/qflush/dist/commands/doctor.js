"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDoctor = runDoctor;
const logger_js_1 = require("../utils/logger.js");
const detect_js_1 = require("../utils/detect.js");
const health_js_1 = require("../utils/health.js");
const paths_js_1 = require("../utils/paths.js");
const exec_js_1 = require("../utils/exec.js");
async function runDoctor(argv = []) {
    const fix = argv.includes('--fix') || argv.includes('-f');
    logger_js_1.logger.info('qflash: running doctor checks...');
    const detected = await (0, detect_js_1.detectModules)();
    for (const k of Object.keys(detected)) {
        const v = detected[k];
        logger_js_1.logger.info(`${k}: installed=${v.installed} running=${v.running} path=${v.path || 'n/a'}`);
        if (v.bin && v.path) {
            logger_js_1.logger.info(`  bin: ${v.bin}`);
        }
    }
    // check node version
    logger_js_1.logger.info(`Node version: ${process.version}`);
    // simple http check example
    const httpOk = await (0, health_js_1.httpProbe)('http://localhost:80', 500);
    logger_js_1.logger.info(`HTTP localhost:80 reachable: ${httpOk}`);
    if (fix) {
        logger_js_1.logger.info('Doctor fix: attempting to install missing Funeste38 packages...');
        for (const name of Object.keys(paths_js_1.SERVICE_MAP)) {
            const pkg = paths_js_1.SERVICE_MAP[name].pkg;
            const detectedInfo = detected[name];
            if (!detectedInfo || !detectedInfo.installed) {
                logger_js_1.logger.info(`Installing ${pkg} for service ${name}...`);
                const ok = (0, exec_js_1.ensurePackageInstalled)(pkg);
                if (ok)
                    logger_js_1.logger.success(`Installed ${pkg}`);
                else
                    logger_js_1.logger.warn(`Failed to install ${pkg}`);
            }
            else {
                logger_js_1.logger.info(`${pkg} already installed`);
            }
        }
    }
    logger_js_1.logger.info('Doctor checks complete');
}
