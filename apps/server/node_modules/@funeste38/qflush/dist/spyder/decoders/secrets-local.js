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
const DEFAULT_MAX_SIZE = 1024 * 1024; // 1 MB
const RULES = [
    {
        rule: 'possible_api_key',
        pattern: /(api[_-]?key|token|secret)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/i,
        severity: 'high',
    },
    {
        rule: 'aws_access_key',
        pattern: /AKIA[0-9A-Z]{16}/,
        severity: 'high',
    },
    {
        rule: 'private_key_block',
        pattern: /-----BEGIN (RSA )?PRIVATE KEY-----/,
        severity: 'high',
    },
];
exports.localSecretScanner = {
    async scanFileForSecrets(filePath, options) {
        const maxSize = options?.maxFileSizeBytes ?? DEFAULT_MAX_SIZE;
        let stat;
        try {
            stat = await fs.stat(filePath);
        }
        catch {
            return [];
        }
        if (!stat.isFile() || stat.size > maxSize) {
            return [];
        }
        let content;
        try {
            content = await fs.readFile(filePath, 'utf8');
        }
        catch {
            return [];
        }
        const findings = [];
        const lines = content.split(/\r?\n/);
        lines.forEach((line, idx) => {
            for (const rule of RULES) {
                const m = rule.pattern.exec(line);
                if (m) {
                    findings.push({
                        file: path.resolve(filePath),
                        line: idx + 1,
                        rule: rule.rule,
                        match: (m[0] || '').slice(0, 200),
                        severity: rule.severity,
                    });
                }
            }
        });
        return findings;
    },
};
