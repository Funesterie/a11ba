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
const vitest_1 = require("vitest");
const applyPacket_js_1 = require("./applyPacket.js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
(0, vitest_1.describe)('applyPacket handlers', () => {
    (0, vitest_1.it)('applies oc8 metadata', async () => {
        const tmp = path.join(process.cwd(), '.qflush', 'test-oc8');
        try {
            if (!fs.existsSync(path.dirname(tmp)))
                fs.mkdirSync(path.dirname(tmp), { recursive: true });
        }
        catch (e) { }
        const pkt = { type: 'cortex:oc8', id: 't-oc8-1', payload: { info: { name: 'OC8TEST', description: 'test' } } };
        await applyPacket_js_1.applyCortexPacket(pkt);
        const out = path.join(process.cwd(), '.qflush', 'oc8.meta.json');
        (0, vitest_1.expect)(fs.existsSync(out)).toBe(true);
        const j = JSON.parse(fs.readFileSync(out, 'utf8'));
        (0, vitest_1.expect)(j.name).toBe('OC8TEST');
    });
    (0, vitest_1.it)('applies auto-patch dry-run and does not write config', async () => {
        const cfg = path.join(process.cwd(), '.qflush', 'config.json');
        try {
            if (fs.existsSync(cfg))
                fs.unlinkSync(cfg);
        }
        catch (e) { }
        const pkt = { type: 'cortex:auto-patch', id: 't-patch-1', payload: { patch: { flags: { testMode: true } }, dryRun: true } };
        await applyPacket_js_1.applyCortexPacket(pkt);
        (0, vitest_1.expect)(fs.existsSync(cfg)).toBe(false);
    });
});
