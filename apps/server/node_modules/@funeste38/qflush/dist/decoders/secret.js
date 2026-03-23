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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanFileForSecrets = scanFileForSecrets;
const fs_1 = __importDefault(require("fs"));
const path = __importStar(require("path"));
const SECRET_PATTERNS = [
    /ghp_[0-9A-Za-z]{30,}/g, // GitHub token (legacy / variants)
    /gho_[0-9A-Za-z]{30,}/g, // GitHub OAuth variants
    /AIza[0-9A-Za-z\-_]{35}/g, // Google API key style
    /sk-[0-9a-zA-Z]{32,}/g, // OpenAI / Stripe style
    /AKIA[0-9A-Z]{16}/g, // AWS access key
    /ya29\.[0-9A-Za-z\-_\.]+/g, // Google OAuth token-ish
    /xox[baprs]-[0-9A-Za-z-]+/g, // Slack tokens
    /-----BEGIN (RSA )?PRIVATE KEY-----[\s\S]*?-----END (RSA )?PRIVATE KEY-----/g,
    new RegExp('password\\s*[:=]\\s*["\\\']?.{4,}', 'gi') // password = ...
];
/** Retourne le numéro de ligne (1-based) pour un index dans la string */
function lineNumberFor(text, index) {
    if (index <= 0)
        return 1;
    return text.slice(0, index).split(/\r\n|\r|\n/).length;
}
/** Récupère extrait centré sur l'index (safe) */
function snippetAt(text, index, radius = 40) {
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + radius);
    return text.slice(start, end).replace(/\r?\n/g, ' ');
}
/**
 * Scanne un fichier pour les secrets et retourne les correspondances.
 * - filePath: chemin absolu ou relatif vers le fichier texte à scanner.
 */
function scanFileForSecrets(filePath) {
    const abs = path.resolve(filePath);
    if (!fs_1.default.existsSync(abs)) {
        throw new Error(`fichier introuvable: ${abs}`);
    }
    const text = fs_1.default.readFileSync(abs, 'utf8');
    const results = [];
    for (const regexOrig of SECRET_PATTERNS) {
        // clone regex pour éviter l'état lastIndex partagé
        const flags = regexOrig.flags.includes('g') ? regexOrig.flags : regexOrig.flags + 'g';
        const regex = new RegExp(regexOrig.source, flags);
        let m;
        while ((m = regex.exec(text)) !== null) {
            const idx = m.index;
            results.push({
                file: abs,
                pattern: regexOrig.toString(),
                match: m[0],
                index: idx,
                line: lineNumberFor(text, idx),
                snippet: snippetAt(text, idx, 60)
            });
            // sécurité anti-boucle si regex vide
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
        }
    }
    return results;
}
