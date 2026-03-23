"use strict";
// ROME-TAG: 0x925520
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
exports.getNpzNamespace = getNpzNamespace;
const crypto = __importStar(require("crypto"));
function getNpzNamespace() {
    // allow override
    const env = process.env.NPZ_NAMESPACE;
    if (env && env.trim().length > 0)
        return env.trim();
    const seed = 'npz';
    try {
        // try to require the nezlephant package directly to avoid loading the whole lib index
        // which may pull packages that are not compatible in the runner.
        const nez = require('@funeste38/nezlephant');
        if (nez) {
            if (typeof nez.encode === 'function') {
                const out = nez.encode(seed);
                if (typeof out === 'string' && out.length >= 8)
                    return out.slice(0, 8);
            }
            if (typeof nez.hash === 'function') {
                const h = nez.hash(seed);
                if (typeof h === 'string' && h.length >= 8)
                    return h.slice(0, 8);
            }
        }
    }
    catch (e) {
        // ignore and fallback
    }
    // fallback: sha256(seed) and take first 4 bytes (8 hex chars)
    const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8);
    return hash;
}
exports.default = { getNpzNamespace };
