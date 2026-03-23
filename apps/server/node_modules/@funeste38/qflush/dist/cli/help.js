"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showHelp = showHelp;
const logger_js_1 = require("../utils/logger.js");
function showHelp() {
    logger_js_1.logger.info(`qflash - Funesterie orchestrator`);
    console.log(`
Usage:
  qflash [command] [options]

Commands:
  start        Launch selected services (default: detect → config → start)
  kill         Kill running services
  purge        Clear caches, logs and sessions
  inspect      Show running services and ports
  config       Generate missing .env/config files

Options (examples):
  --service rome --path D:/rome --token ABC123     Target a specific service and give path/token
  --service nezlephant --service freeland          Target multiple services
  --dev --fresh                                    Global flags (dev mode, fresh start)
  --force                                          Force restart semantics (implies kill before start)

Examples:
  qflash start --service rome --path D:/rome
  qflash start --service nezlephant --service freeland --fresh
  qflash config --service freeland
  qflash purge --fresh

`);
}
