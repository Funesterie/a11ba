"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCompose = runCompose;
const parser_js_1 = require("../compose/parser.js");
const logger_js_1 = require("../utils/logger.js");
const start_js_1 = require("./start.js");
const index_js_1 = require("../supervisor/index.js");
const purge_js_1 = require("./purge.js");
const fs = __importStar(require("fs"));
const tail_1 = require("tail");
async function runCompose(argv) {
    const sub = argv[0];
    const compose = (0, parser_js_1.readCompose)();
    if (!compose) {
        logger_js_1.logger.error('No funesterie.yml or funesterie.fcl found');
        return;
    }
    if (sub === 'up') {
        // support --background flag
        const bg = argv.includes('--background') || argv.includes('-b');
        const modules = Object.keys(compose.modules);
        for (const m of modules) {
            const def = compose.modules[m];
            logger_js_1.logger.info(`Bringing up ${m} from ${def.path || 'package'}`);
            if (bg) {
                // start in background using supervisor
                const logPath = `${process.cwd()}/.qflash/logs/${m}.log`;
                (0, index_js_1.startProcess)(m, def.path || m, [], { cwd: def.path || process.cwd(), detached: true, logPath });
            }
            else {
                await (0, start_js_1.runStart)({ services: [m], modulePaths: { [m]: def.path }, flags: {} });
            }
        }
        return;
    }
    if (sub === 'down') {
        logger_js_1.logger.info('Bringing down all modules');
        await (0, purge_js_1.runPurge)();
        return;
    }
    if (sub === 'restart') {
        const name = argv[1];
        if (!name) {
            logger_js_1.logger.info('Specify module to restart');
            return;
        }
        // naive: stop and start
        const running = (0, index_js_1.listRunning)();
        if (running.find((r) => r.name === name)) {
            // stop
            await (0, index_js_1.stopProcess)(name);
        }
        const def = compose.modules[name];
        if (!def) {
            logger_js_1.logger.info('Unknown module');
            return;
        }
        await (0, start_js_1.runStart)({ services: [name], modulePaths: { [name]: def.path }, flags: {} });
        return;
    }
    if (sub === 'logs') {
        const name = argv[1];
        if (!name) {
            logger_js_1.logger.info('Specify module name');
            return;
        }
        const logFile = `${process.cwd()}/.qflash/logs/${name}.log`;
        if (!fs.existsSync(logFile)) {
            logger_js_1.logger.info('No log file found');
            return;
        }
        const t = new tail_1.Tail(logFile, { fromBeginning: false });
        t.on('line', (data) => console.log(data));
        t.on('error', (err) => console.error(err));
        return;
    }
    logger_js_1.logger.info('Usage: qflash compose [up|down|restart|logs]');
}
