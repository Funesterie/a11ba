"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInspect = runInspect;
const logger_1 = require("../utils/logger");
const detect_1 = require("../utils/detect");
const supervisor_1 = require("../supervisor");
async function runInspect(opts) {
    logger_1.logger.info("qflash: inspecting ecosystem...");
    const detected = opts?.detected || (await (0, detect_1.detectModules)());
    for (const key of Object.keys(detected)) {
        const v = detected[key];
        logger_1.logger.info(`${key}: ${v.running ? `running (pid=${v.pid || 'unknown'})` : 'stopped'}`);
        if (v.port)
            logger_1.logger.info(`  port: ${v.port}`);
        if (v.installed)
            logger_1.logger.info(`  installed: true`);
    }
    const running = (0, supervisor_1.listRunning)();
    if (running.length) {
        logger_1.logger.info("Supervisor running processes:");
        for (const r of running)
            logger_1.logger.info(`  ${r.name}: pid=${r.pid} cmd=${r.cmd}`);
    }
}
