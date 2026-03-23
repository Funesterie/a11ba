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
exports.scanFileForSecrets = scanFileForSecrets;
const fs = __importStar(require("fs"));
function makeMatch(pattern, lineNum, index, snippet) {
    return { pattern, line: lineNum, index, snippet };
}
async function scanFileForSecrets(filePath) {
    try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        const lines = data.split(/\r?\n/);
        const regex = /(api[_-]?key|apikey|secret|password|token|access[_-]?token|private[_-]?key)/i;
        const matches = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const m = regex.exec(line);
            if (m) {
                matches.push(makeMatch(m[0], i + 1, m.index, line.trim()));
            }
        }
        return matches;
    }
    catch (e) {
        return [];
    }
}
