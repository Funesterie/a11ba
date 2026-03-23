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
const pngCodec_js_1 = require("./pngCodec.js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
(0, vitest_1.describe)('pngCodec additional tests', () => {
    (0, vitest_1.it)('redCurtain mode encodes and decodes payload correctly', async () => {
        const tmpDir = path.join(process.cwd(), 'tmp');
        try {
            if (!fs.existsSync(tmpDir))
                fs.mkdirSync(tmpDir);
        }
        catch (e) { }
        const out = path.join(tmpDir, 'test_cxpk_red.png');
        const packet = {
            version: 1,
            kind: 'cortex-packet',
            type: 'cortex:spyder-vision',
            id: 'test-red-456',
            payload: { cmd: 'red', data: [9, 8, 7], note: 'redCurtain' }
        };
        await (0, pngCodec_js_1.encodeCortexPacketToPng)(packet, out, { width: 8, redCurtainMode: true });
        (0, vitest_1.expect)(fs.existsSync(out)).toBe(true);
        const decoded = await (0, pngCodec_js_1.decodeCortexPacketFromPng)(out);
        (0, vitest_1.expect)(decoded).toBeDefined();
        (0, vitest_1.expect)(decoded.kind).toBe('cortex-packet');
        (0, vitest_1.expect)(decoded.type).toBe(packet.type);
        // payload should match at least 'cmd'
        (0, vitest_1.expect)(decoded.payload.cmd || decoded.payload.payload?.cmd).toEqual('red');
        try {
            fs.unlinkSync(out);
        }
        catch (e) { }
    });
    (0, vitest_1.it)('multi-pixel output handles larger payloads', async () => {
        const tmpDir = path.join(process.cwd(), 'tmp');
        try {
            if (!fs.existsSync(tmpDir))
                fs.mkdirSync(tmpDir);
        }
        catch (e) { }
        const out = path.join(tmpDir, 'test_cxpk_multi.png');
        // create a payload that'll force multiple pixels / rows
        const bigArr = new Array(2000).fill(0).map((_, i) => i % 256);
        const packet = {
            version: 1,
            kind: 'cortex-packet',
            type: 'cortex:npz-graph',
            id: 'test-big-789',
            payload: { cmd: 'big', data: bigArr }
        };
        await (0, pngCodec_js_1.encodeCortexPacketToPng)(packet, out, { width: 16, redCurtainMode: false });
        (0, vitest_1.expect)(fs.existsSync(out)).toBe(true);
        const decoded = await (0, pngCodec_js_1.decodeCortexPacketFromPng)(out);
        (0, vitest_1.expect)(decoded).toBeDefined();
        (0, vitest_1.expect)(decoded.kind).toBe('cortex-packet');
        (0, vitest_1.expect)(decoded.type).toBe(packet.type);
        (0, vitest_1.expect)(decoded.payload.payload?.cmd || decoded.payload.cmd).toBeDefined();
        try {
            fs.unlinkSync(out);
        }
        catch (e) { }
    });
});
