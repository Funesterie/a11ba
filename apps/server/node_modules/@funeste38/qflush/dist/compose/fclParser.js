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
exports.readFCL = readFCL;
const fs = __importStar(require("fs"));
function parseValue(raw) {
    const v = raw.trim();
    if (v.startsWith('[') && v.endsWith(']')) {
        // simple list parser
        const inside = v.slice(1, -1).trim();
        if (!inside)
            return [];
        return inside.split(',').map(x => x.trim().replace(/^"|"$/g, ''));
    }
    if (/^\d+$/.test(v))
        return Number(v);
    return v.replace(/^"|"$/g, '');
}
function readFCL(file = 'funesterie.fcl') {
    try {
        const raw = fs.readFileSync(file, 'utf8');
        const lines = raw.split(/\r?\n/);
        const out = { project: {}, env: {}, service: {}, pipeline: {} };
        let current = {};
        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#') || line.startsWith('//'))
                continue;
            if (line.startsWith('@')) {
                const parts = line.split(/\t|\s+/).filter(Boolean);
                const sec = parts[0].slice(1);
                const name = parts[1] || undefined;
                current = { section: sec, name };
                if (name) {
                    if (!out[sec])
                        out[sec] = {};
                    out[sec][name] = out[sec][name] || {};
                }
                continue;
            }
            const eq = line.indexOf('=');
            if (eq === -1)
                continue;
            const key = line.slice(0, eq).trim();
            const val = parseValue(line.slice(eq + 1));
            if (current.section) {
                if (current.name) {
                    out[current.section][current.name][key] = val;
                }
                else {
                    out[current.section][key] = val;
                }
            }
        }
        return out;
    }
    catch (err) {
        return null;
    }
}
