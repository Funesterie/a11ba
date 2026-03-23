"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTestsSafe = runTestsSafe;
const logger_js_1 = require("../utils/logger.js");
const node_child_process_1 = require("node:child_process");
async function runTestsSafe() {
    logger_js_1.logger.info('PICCOLO: lancement des tests en mode safe...');
    try {
        (0, node_child_process_1.execSync)('npx vitest run', { stdio: 'inherit' });
        return true;
    }
    catch (e) {
        logger_js_1.logger.warn('PICCOLO: tests échoués ou erreur: ' + String(e));
        return false;
    }
}
