"use strict";
// ROME-TAG: 0x34E4E4
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
exports.runTests = runTests;
const executor_js_1 = require("../rome/executor.js");
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function runTests() {
    // start webhook server
    const calls = [];
    const srv = http.createServer((req, res) => {
        let raw = '';
        req.on('data', d => raw += d.toString());
        req.on('end', () => { try {
            calls.push(JSON.parse(raw));
        }
        catch (e) { } res.end('ok'); });
    }).listen(0);
    const port = srv.address().port;
    const cfgPath = path.join(process.cwd(), '.qflush', 'logic-config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    cfg.webhookUrl = `http://127.0.0.1:${port}`;
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
    // disallowed command
    const res1 = await (0, executor_js_1.executeAction)('run "rm -rf /" in "./"');
    if (res1.success) {
        console.error('dangerous command should not be allowed');
        throw new Error('dangerous command should not be allowed');
    }
    // allowed echo
    const res2 = await (0, executor_js_1.executeAction)('run "echo hello" in "./"');
    if (!res2.success) {
        console.error('echo should be allowed', res2);
        throw new Error('echo should be allowed');
    }
    // npz encode triggers webhook
    const res3 = await (0, executor_js_1.executeAction)('npz.encode file', { path: 'assets/banner.png' });
    if (!res3.success) {
        console.error('npz should succeed', res3);
        throw new Error('npz should succeed');
    }
    // wait a moment for webhook calls
    await new Promise(r => setTimeout(r, 400));
    if (calls.length === 0) {
        console.error('webhook not called');
        throw new Error('webhook not called');
    }
    srv.close();
    console.log('executor tests passed');
}
const vitest_1 = require("vitest");
(0, vitest_1.describe)('executor (stub)', () => {
    (0, vitest_1.it)('stub passes', () => {
        (0, vitest_1.expect)(true).toBe(true);
    });
});
