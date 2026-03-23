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
exports.cortexSend = cortexSend;
exports.cortexWaitFor = cortexWaitFor;
const path = __importStar(require("path"));
const encoder_js_1 = require("./encoder.js");
const fs = __importStar(require("fs"));
function cortexSend(cmd, args = []) {
    const id = 'cortex-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const ner = { id, cmd, args, timestamp: Date.now() };
    const out = path.join('.qflush', 'cortex', 'inbox', id + '.png');
    (0, encoder_js_1.encodeCortexCommand)(ner, out);
    return id;
}
function cortexWaitFor(id, timeoutMs = 5000) {
    const out = path.join('.qflush', 'cortex', 'outbox', id + '.png');
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const iv = setInterval(() => {
            if (Date.now() - start > timeoutMs) {
                clearInterval(iv);
                return reject(new Error('timeout'));
            }
            if (fs.existsSync(out)) {
                try {
                    const dec = require('./decoder').decodeCortexPNG(out);
                    try {
                        fs.unlinkSync(out);
                    }
                    catch (e) { }
                    clearInterval(iv);
                    resolve(dec);
                }
                catch (e) {
                    clearInterval(iv);
                    reject(e);
                }
            }
        }, 200);
    });
}
