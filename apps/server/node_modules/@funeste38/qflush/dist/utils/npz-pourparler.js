"use strict";
// ROME-TAG: 0x94B7C0
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
exports.startSession = startSession;
exports.sendMessage = sendMessage;
exports.getHistory = getHistory;
exports.endSession = endSession;
exports.encodeAscii4 = encodeAscii4;
exports.colorizeAscii4 = colorizeAscii4;
const crypto = __importStar(require("crypto"));
const SESSIONS = new Map();
function id() { return Math.random().toString(36).slice(2, 10); }
function startSession(systemPrompt = '') {
    const sid = 's_' + id();
    const s = { id: sid, messages: [], createdAt: Date.now() };
    if (systemPrompt)
        s.messages.push({ id: 'm_' + id(), role: 'system', text: systemPrompt, t: Date.now() });
    SESSIONS.set(sid, s);
    return s;
}
function sendMessage(sessionId, role, text) {
    const s = SESSIONS.get(sessionId);
    if (!s)
        throw new Error('session not found');
    const m = { id: 'm_' + id(), role, text, t: Date.now() };
    s.messages.push(m);
    return m;
}
function getHistory(sessionId) {
    const s = SESSIONS.get(sessionId);
    if (!s)
        return [];
    return s.messages.slice();
}
function endSession(sessionId) {
    return SESSIONS.delete(sessionId);
}
// --- New: ASCII 4-byte encoding + colorize helpers ---
function md5First4BytesHex(ch) {
    // return first 4 bytes (8 hex chars) of md5 of the char
    const h = crypto.createHash('md5').update(ch).digest('hex');
    return h.slice(0, 8);
}
function encodeAscii4(text) {
    const out = [];
    for (const ch of text) {
        out.push({ ch, hex4: md5First4BytesHex(ch) });
    }
    return out;
}
function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
}
function byteToColor(b) {
    // map single byte [0..255] to a color by expanding into RGB via simple transform
    const r = (b * 3) % 256;
    const g = (b * 7) % 256;
    const b2 = (b * 13) % 256;
    return { r, g, b: b2 };
}
function colorizeAscii4(text) {
    // returns ANSI colored string: for each char produce a colored block based on its 4-byte hex
    const parts = [];
    for (const ch of text) {
        const hex4 = md5First4BytesHex(ch); // 8 hex chars
        // split into 4 bytes
        const bytes = [];
        for (let i = 0; i < 8; i += 2)
            bytes.push(parseInt(hex4.slice(i, i + 2), 16));
        // pick a representative color from bytes
        const col = byteToColor(bytes[0]);
        const ansi = `\x1b[48;2;${col.r};${col.g};${col.b}m\x1b[38;2;0;0;0m ${ch} \x1b[0m`;
        parts.push(ansi);
    }
    return parts.join('');
}
exports.default = { startSession, sendMessage, getHistory, endSession, encodeAscii4, colorizeAscii4 };
