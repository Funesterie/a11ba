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
exports.startCortexBus = startCortexBus;
const fs_1 = __importDefault(require("fs"));
const path = __importStar(require("path"));
const decoder_js_1 = require("./decoder.js");
const encoder_js_1 = require("./encoder.js");
const executor_js_1 = require("../rome/executor.js");
const inbox = path.join('.qflush', 'cortex', 'inbox');
const outbox = path.join('.qflush', 'cortex', 'outbox');
function startCortexBus() {
    fs_1.default.mkdirSync(inbox, { recursive: true });
    fs_1.default.mkdirSync(outbox, { recursive: true });
    console.log('[CORTEX] Bus démarré — watching', inbox);
    const processFile = async (file) => {
        const full = path.join(inbox, file);
        if (!file.endsWith('.png'))
            return;
        try {
            const payload = (0, decoder_js_1.decodeCortexPNG)(full);
            const result = await (0, executor_js_1.execCommand)(payload.cmd, payload.args || []);
            const response = { id: payload.id, ok: true, result, timestamp: Date.now() };
            const out = path.join(outbox, file);
            (0, encoder_js_1.encodeCortexCommand)(response, out);
        }
        catch (e) {
            console.error('[CORTEX] processing error', e);
            const resp = { id: path.basename(file, '.png'), ok: false, error: String(e), timestamp: Date.now() };
            try {
                (0, encoder_js_1.encodeCortexCommand)(resp, path.join(outbox, file));
            }
            catch (e2) { /* ignore */ }
        }
        finally {
            try {
                fs_1.default.unlinkSync(full);
            }
            catch (e) { /* ignore */ }
        }
    };
    // simple poll/watch to be robust
    setInterval(() => {
        try {
            const files = fs_1.default.readdirSync(inbox || '.');
            for (const f of files) {
                processFile(f);
            }
        }
        catch (e) {
            // ignore
        }
    }, 500);
}
