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
exports.repairTsConfig = repairTsConfig;
const logger_js_1 = require("../utils/logger.js");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
async function repairTsConfig() {
    logger_js_1.logger.info('PICCOLO: vérification et réparation du tsconfig...');
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath))
        return;
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    let changed = false;
    if (tsconfig.compilerOptions?.moduleResolution !== 'nodenext') {
        tsconfig.compilerOptions.moduleResolution = 'nodenext';
        changed = true;
    }
    if (!tsconfig.compilerOptions?.types?.includes('node')) {
        tsconfig.compilerOptions.types = tsconfig.compilerOptions.types || [];
        tsconfig.compilerOptions.types.push('node');
        changed = true;
    }
    if (!tsconfig.compilerOptions?.types?.includes('vitest')) {
        tsconfig.compilerOptions.types = tsconfig.compilerOptions.types || [];
        tsconfig.compilerOptions.types.push('vitest');
        changed = true;
    }
    // Vérifie les alias paths
    const expectedPaths = {
        '@utils/*': ['src/utils/*'],
        '@daemon/*': ['src/daemon/*'],
        '@commands/*': ['src/commands/*'],
        '@rome/*': ['src/rome/*'],
        '@supervisor/*': ['src/supervisor/*'],
        '@cortex/*': ['src/cortex/*']
    };
    tsconfig.compilerOptions.paths = tsconfig.compilerOptions.paths || {};
    for (const k of Object.keys(expectedPaths)) {
        if (JSON.stringify(tsconfig.compilerOptions.paths[k]) !== JSON.stringify(expectedPaths[k])) {
            tsconfig.compilerOptions.paths[k] = expectedPaths[k];
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf8');
        logger_js_1.logger.info('PICCOLO: tsconfig.json corrigé');
    }
}
