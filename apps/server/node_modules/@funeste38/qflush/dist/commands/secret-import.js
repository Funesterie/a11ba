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
exports.default = runSecretImport;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
async function runSecretImport(argv = []) {
    // usage: qflush secret import [--env <path>] [--no-acl]
    let envPath;
    let restrictAcl = true;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if ((a === '--env' || a === '-e') && i < argv.length - 1) {
            envPath = argv[i + 1];
            i++;
            continue;
        }
        if (a === '--no-acl') {
            restrictAcl = false;
            continue;
        }
    }
    // default envPath to Desktop .env
    if (!envPath) {
        const home = process.env.USERPROFILE || process.env.HOME || '';
        envPath = path.join(home, 'Desktop', '.env');
    }
    const script = path.join(process.cwd(), 'scripts', 'import-env-to-secrets.ps1');
    const pwsh = process.env.PWSH || 'pwsh';
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-EnvPath', envPath];
    if (restrictAcl)
        args.push('-RestrictFileAcl');
    console.log('Running import script:', pwsh, args.join(' '));
    const res = (0, child_process_1.spawnSync)(pwsh, args, { stdio: 'inherit' });
    if (res.error) {
        console.error('Failed to execute import script:', res.error);
        return 2;
    }
    return res.status ?? 0;
}
