#!/usr/bin/env node
"use strict";
// ROME-TAG: 0x10C74C
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
exports.default = runCopilotBridge;
const fs = __importStar(require("fs"));
async function resolveFetch() {
    // prefer global
    if (typeof globalThis.fetch === 'function')
        return globalThis.fetch;
    try {
        const m = await import('node-fetch');
        return (m && m.default) || m;
    }
    catch (e) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const undici = require('undici');
            if (undici && typeof undici.fetch === 'function')
                return undici.fetch;
        }
        catch (_) { }
    }
    throw new Error('No fetch implementation available (install node-fetch or undici)');
}
async function runCopilotBridge(args) {
    const cfgPath = '.qflush/copilot.json';
    if (!fs.existsSync(cfgPath)) {
        console.error('copilot not configured');
        return 1;
    }
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (args[0] === 'send-snapshot') {
        const state = { /* minimal snapshot */};
        try {
            const fetch = await resolveFetch();
            await fetch(cfg.webhookUrl, { method: 'POST', body: JSON.stringify({ type: 'engine_snapshot', snapshot: state }), headers: { 'Content-Type': 'application/json' } });
            console.log('sent');
        }
        catch (e) {
            console.error('failed', e);
            return 2;
        }
        return 0;
    }
    console.log('copilot-bridge: noop');
    return 0;
}
