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
exports.startCortexListener = startCortexListener;
// Cortex listener: watch a folder for PNG packets and dispatch decoded JSON to router
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const codec_js_1 = require("./codec.js");
const router_js_1 = require("./router.js");
const services_js_1 = require("../services.js");
const WATCH_DIR = path.join(process.cwd(), 'canal');
function startCortexListener() {
    try {
        if (!fs.existsSync(WATCH_DIR))
            fs.mkdirSync(WATCH_DIR, { recursive: true });
    }
    catch (e) { }
    console.log('[CORTEX] listener watching', WATCH_DIR);
    const pending = new Set();
    // initialize service clients once
    const services = (0, services_js_1.getServiceClients)();
    fs.watch(WATCH_DIR, { persistent: false }, async (ev, filename) => {
        if (!filename)
            return;
        const full = path.join(WATCH_DIR, filename);
        if (!filename.endsWith('.png'))
            return;
        if (pending.has(full))
            return;
        pending.add(full);
        // give the file a moment to be fully written
        setTimeout(async () => {
            try {
                // find all matching parts for this prefix
                const prefix = filename.replace(/_part\d+\.png$/, '');
                const glob = fs.readdirSync(WATCH_DIR).filter(f => f.startsWith(prefix) && f.endsWith('.png')).map(f => path.join(WATCH_DIR, f)).sort();
                if (!glob.length) {
                    pending.delete(full);
                    return;
                }
                const fullBuf = await (0, codec_js_1.decodePNGsToPacket)(glob);
                const parsed = (0, codec_js_1.parseCortexPacket)(fullBuf);
                // attempt to decode payload to JSON where possible
                let payload = null;
                try {
                    const txt = parsed.raw.toString('utf-8');
                    payload = JSON.parse(txt);
                }
                catch (e) {
                    payload = parsed.raw;
                }
                const routed = await (0, router_js_1.routeCortexPacket)({ totalLen: parsed.totalLen, payloadLen: parsed.payloadLen, flags: parsed.flags, payload }, services);
                console.log('[CORTEX] routed packet result', routed);
            }
            catch (e) {
                console.warn('[CORTEX] decode failed', e);
            }
            finally {
                pending.delete(full);
            }
        }, 200);
    });
}
