"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDetect = runDetect;
const detect_js_1 = require("../utils/detect.js");
const logger_js_1 = require("../utils/logger.js");
async function runDetect(_opts) {
    logger_js_1.logger.info("qflash: detecting modules...");
    const detected = await (0, detect_js_1.detectModules)();
    for (const k of Object.keys(detected)) {
        const v = detected[k];
        logger_js_1.logger.info(`${k}: ${v.running ? 'running' : 'stopped'}`);
    }
    // return a normalized object
    return { detected, paths: {} };
}
