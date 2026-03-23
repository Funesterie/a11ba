"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runKill = runKill;
const logger_js_1 = require("../utils/logger.js");
const detect_js_1 = require("../utils/detect.js");
const supervisor_js_1 = require("../supervisor.js");
async function runKill(_opts) {
    logger_js_1.logger.info("qflash: killing modules...");
    const killed = await (0, detect_js_1.findAndKill)();
    (0, supervisor_js_1.stopAll)();
    logger_js_1.logger.info(`Killed ${killed.length} processes`);
}
