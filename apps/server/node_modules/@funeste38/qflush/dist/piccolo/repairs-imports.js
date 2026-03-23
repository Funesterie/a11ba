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
exports.repairImportsAndDeps = repairImportsAndDeps;
const logger_js_1 = require("../utils/logger.js");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
function getAllSourceFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllSourceFiles(fullPath));
        }
        else if (fullPath.endsWith('.ts') || fullPath.endsWith('.js')) {
            results.push(fullPath);
        }
    }
    return results;
}
function fixImportExtensions(file) {
    let changed = false;
    let content = fs.readFileSync(file, 'utf8');
    // Corrige les imports sans extension .js pour ESM
    content = content.replace(/(import\s+[^'";]+['"])(\.\/.+?)(['"])/g, (match, p1, p2, p3) => {
        if (!p2.endsWith('.js') && fs.existsSync(path.resolve(path.dirname(file), p2 + '.js'))) {
            changed = true;
            return p1 + p2 + '.js' + p3;
        }
        return match;
    });
    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        logger_js_1.logger.info(`PICCOLO: import corrigé dans ${file}`);
    }
}
function ensureDepsInstalled() {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(pkgPath))
        return;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const needed = ['vitest', 'canvas'];
    let toInstall = [];
    for (const dep of needed) {
        if (!pkg.dependencies?.[dep] && !pkg.devDependencies?.[dep]) {
            toInstall.push(dep);
        }
    }
    if (toInstall.length) {
        logger_js_1.logger.info(`PICCOLO: installation des dépendances manquantes: ${toInstall.join(', ')}`);
        require('child_process').execSync(`npm install --save-dev ${toInstall.join(' ')}`, { stdio: 'inherit' });
    }
}
async function repairImportsAndDeps() {
    logger_js_1.logger.info('PICCOLO: scan et réparation des imports/dépendances...');
    const files = getAllSourceFiles(path.join(process.cwd(), 'src'));
    for (const file of files) {
        fixImportExtensions(file);
    }
    ensureDepsInstalled();
}
