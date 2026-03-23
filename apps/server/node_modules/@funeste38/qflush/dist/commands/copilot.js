#!/usr/bin/env node
"use strict";
// ROME-TAG: 0x5293A0
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
exports.default = runCopilot;
const fetch_js_1 = __importDefault(require("../utils/fetch.js"));
const readline = __importStar(require("readline"));
async function postMessage(msg) {
    try {
        const res = await (0, fetch_js_1.default)(`${process.env.QFLUSH_DAEMON || 'http://localhost:4500'}/copilot/message`, { method: 'POST', body: JSON.stringify({ message: msg }), headers: { 'Content-Type': 'application/json' } });
        const j = await res.json();
        console.log('sent', j);
    }
    catch (e) {
        console.error('send failed', e);
    }
}
async function runCopilot(args) {
    if (args.includes('--stream')) {
        // open SSE stream
        const EventSource = require('eventsource');
        const es = new EventSource(`${process.env.QFLUSH_DAEMON || 'http://localhost:4500'}/copilot/stream`);
        es.onmessage = (ev) => { console.log('copilot event', ev.data); };
        es.onerror = (e) => { console.error('SSE error', e); es.close(); };
        return 0;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('message> ', async (answer) => { await postMessage(answer); rl.close(); process.exit(0); });
    return 0;
}
