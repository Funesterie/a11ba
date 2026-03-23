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
exports.localSecretScanner = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
exports.localSecretScanner = {
    async scanFileForSecrets(filePath) {
        const content = await fs.readFile(filePath, 'utf8').catch(() => null);
        if (!content)
            return [];
        const findings = [];
        const lines = content.split(/\r?\n/);
        const rules = [
            { name: 'api_key', regex: /(api[_-]?key|token|secret)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}/i },
            { name: 'aws_key', regex: /AKIA[0-9A-Z]{16}/ },
            { name: 'private_block', regex: /-----BEGIN (RSA )?PRIVATE KEY-----/ },
        ];
        lines.forEach((line, i) => {
            for (const r of rules) {
                const m = r.regex.exec(line);
                if (m) {
                    findings.push({
                        file: path.resolve(filePath),
                        line: i + 1,
                        rule: r.name,
                        match: m[0].slice(0, 200),
                        severity: 'high',
                    });
                }
            }
        });
        return findings;
    }
};
