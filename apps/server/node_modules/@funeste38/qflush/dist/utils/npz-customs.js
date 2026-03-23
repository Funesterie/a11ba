"use strict";
// ROME-TAG: 0x91FBE1
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
exports.portScanner = exports.fileScanner = exports.envScanner = exports.MODULES = void 0;
exports.runCustomsCheck = runCustomsCheck;
exports.hasBlockingIssues = hasBlockingIssues;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const net = __importStar(require("net"));
const alias = __importStar(require("./alias.js"));
const logger = alias.importUtil('@utils/logger') || alias.importUtil('./logger') || console;
exports.MODULES = [
    { name: 'freeland', pkg: '@funeste38/freeland', cwd: process.cwd(), requiredEnv: ['FREELAND_DB_URL'], requiredFiles: ['freeland.config.json'] },
    { name: 'bat', pkg: '@funeste38/bat', cwd: process.cwd(), requiredEnv: ['BAT_TOKEN'], requiredFiles: ['bat.config.json'] },
];
const envScanner = async (mod) => {
    const issues = [];
    const required = mod.requiredEnv || [];
    for (const key of required) {
        if (!process.env[key]) {
            issues.push({ level: 'block', code: 'MISSING_ENV', message: `Missing env var: ${key}` });
        }
    }
    return issues;
};
exports.envScanner = envScanner;
const fileScanner = async (mod) => {
    const issues = [];
    const required = mod.requiredFiles || [];
    for (const rel of required) {
        const full = path.join(mod.cwd, rel);
        if (!fs.existsSync(full)) {
            issues.push({ level: 'warning', code: 'MISSING_FILE', message: `Config file not found: ${rel}` });
        }
    }
    return issues;
};
exports.fileScanner = fileScanner;
function checkPortInUse(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(true));
        server.once('listening', () => {
            server.close(() => resolve(false));
        });
        server.listen(port, '127.0.0.1');
    });
}
const portScanner = async (mod) => {
    const issues = [];
    const ports = mod.requiredPorts || [];
    for (const port of ports) {
        if (await checkPortInUse(port)) {
            issues.push({ level: 'block', code: 'PORT_IN_USE', message: `Port ${port} already in use` });
        }
    }
    return issues;
};
exports.portScanner = portScanner;
const SCANNERS = [exports.envScanner, exports.fileScanner, exports.portScanner];
async function runCustomsCheck(mod) {
    const issues = [];
    for (const scanner of SCANNERS) {
        try {
            const res = await scanner(mod);
            if (res && res.length)
                issues.push(...res);
        }
        catch (err) {
            logger.warn(`customs: scanner error for ${mod.name} ${err}`);
        }
    }
    if (issues.length === 0) {
        logger.info(`[NPZ][CUSTOMS][PASS] ${mod.name} - all clear`);
    }
    else {
        for (const issue of issues) {
            const tag = issue.level.toUpperCase();
            if (issue.level === 'block')
                logger.warn(`[NPZ][CUSTOMS][${tag}] ${mod.name} - ${issue.message}`);
            else
                logger.info(`[NPZ][CUSTOMS][${tag}] ${mod.name} - ${issue.message}`);
        }
    }
    return { module: mod.name, issues };
}
function hasBlockingIssues(report) {
    return report.issues.some((i) => i.level === 'block');
}
exports.default = {
    MODULES: exports.MODULES,
    runCustomsCheck,
    hasBlockingIssues,
};
