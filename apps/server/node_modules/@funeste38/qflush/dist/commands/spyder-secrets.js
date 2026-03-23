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
exports.spyderSecretsCommand = spyderSecretsCommand;
const path = __importStar(require("path"));
const loadSecretsScanner_js_1 = require("../spyder/decoders/loadSecretsScanner.js");
async function spyderSecretsCommand(dumpPath) {
    const file = dumpPath ?? path.join(process.cwd(), 'parts', 'qflush-code-dump.txt');
    try {
        const scanner = await (0, loadSecretsScanner_js_1.loadSecretScanner)();
        if (!scanner || typeof scanner.scanFileForSecrets !== 'function') {
            console.log('[SPYDER] No scanner available, skipping');
            return 0;
        }
        const findings = await scanner.scanFileForSecrets(file);
        if (!findings || findings.length === 0) {
            console.log('[SPYDER] Aucun secret détecté ✅');
            return 0;
        }
        console.log(`[SPYDER] ${findings.length} secrets potentiels trouvés :`);
        for (const f of findings) {
            console.log(`  - ${f.file}:${f.line} [${f.severity}] ${f.rule} → ${f.match.slice(0, 80)}`);
        }
        return 0;
    }
    catch (e) {
        console.error('[SPYDER] Erreur pendant le scan :', String(e));
        return 1;
    }
}
// allow running directly
if (typeof require !== 'undefined' && require.main === module) {
    const arg = process.argv[2];
    spyderSecretsCommand(arg).then((code) => process.exit(code));
}
