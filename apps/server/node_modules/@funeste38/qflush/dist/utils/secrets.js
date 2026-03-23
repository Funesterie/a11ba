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
exports.getSecret = getSecret;
const fs = __importStar(require("fs"));
function getSecret(name, opts) {
    // 1) CLI arg form --name=value or --alias=value
    const alias = opts?.cliAlias || name.toLowerCase();
    const cliExact = process.argv.find((a) => a === `--${alias}`);
    if (cliExact) {
        // next arg is the value
        const idx = process.argv.indexOf(cliExact);
        if (idx >= 0 && idx < process.argv.length - 1)
            return process.argv[idx + 1];
    }
    const cli = process.argv.find((a) => a.startsWith(`--${alias}=`));
    if (cli)
        return cli.split('=')[1];
    // 2) environment variables (exact name or upper-case)
    if (process.env[name])
        return process.env[name];
    const up = name.toUpperCase();
    if (process.env[up])
        return process.env[up];
    const low = name.toLowerCase();
    if (process.env[low])
        return process.env[low];
    // 3) file referenced by env var
    if (opts && opts.fileEnv) {
        const p = process.env[opts.fileEnv];
        if (p && typeof p === 'string' && fs.existsSync(p)) {
            try {
                return fs.readFileSync(p, 'utf8').trim();
            }
            catch (e) {
                // ignore read errors
            }
        }
    }
    if (opts && opts.required)
        throw new Error(`${name} required but not provided`);
    return undefined;
}
