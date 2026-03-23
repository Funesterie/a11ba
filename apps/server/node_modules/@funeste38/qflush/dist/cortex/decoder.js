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
exports.decodeCortexPNG = decodeCortexPNG;
const fs = __importStar(require("fs"));
const zlib_1 = __importDefault(require("zlib"));
const pngjs_1 = require("pngjs");
const crypto = __importStar(require("crypto"));
const seenIds = new Set();
function decodeCortexPNG(file) {
    const buf = fs.readFileSync(file);
    const png = pngjs_1.PNG.sync.read(buf);
    // Helper: attempt to parse OC8 header embedded directly in RGBA stream
    const tryOc8Header = () => {
        const rgba = Buffer.from(png.data);
        const hdr = Buffer.from('OC8');
        const idx = rgba.indexOf(hdr);
        if (idx === -1)
            return null;
        const verIndex = idx + 3;
        if (verIndex >= rgba.length)
            throw new Error('OC8 header truncated (no version byte)');
        const ver = rgba[verIndex];
        if (ver !== 1)
            console.warn(`decodeCortexPNG: OC8 version ${ver} (expected 1)`);
        const lenIndex = verIndex + 1;
        if (lenIndex + 4 > rgba.length)
            throw new Error('OC8 header truncated (no length)');
        const lenBytes = rgba.slice(lenIndex, lenIndex + 4);
        // little-endian
        const payloadLen = lenBytes.readInt32LE(0);
        const compStart = lenIndex + 4;
        let compEnd = compStart + payloadLen;
        if (compEnd > rgba.length) {
            console.warn(`OC8: advertised payload length ${payloadLen} exceeds available bytes (${rgba.length - compStart}). Truncating.`);
            compEnd = rgba.length;
        }
        const compressed = rgba.slice(compStart, compEnd);
        try {
            const json = zlib_1.default.brotliDecompressSync(compressed);
            return JSON.parse(json.toString('utf8'));
        }
        catch (e) {
            throw new Error('OC8 Brotli decompression/parsing failed: ' + String(e));
        }
    };
    // Helper: take RGB triplets and produce compressed buffer (strip trailing zero padding)
    const rgbCompressedBuffer = () => {
        const bytes = [];
        for (let i = 0; i < png.data.length; i += 4) {
            bytes.push(png.data[i], png.data[i + 1], png.data[i + 2]);
        }
        // trim trailing zeros that were padding
        let end = bytes.length;
        while (end > 0 && bytes[end - 1] === 0)
            end--;
        return Buffer.from(bytes.slice(0, end));
    };
    // 1) Try OC8 header mode first (direct RGBA payload with OC8 header)
    try {
        const oc8Result = tryOc8Header();
        if (oc8Result !== null) {
            // replay protection
            if (oc8Result && oc8Result.id) {
                if (seenIds.has(oc8Result.id))
                    throw new Error('replay detected');
                seenIds.add(oc8Result.id);
                if (seenIds.size > 10000) {
                    const it = seenIds.values();
                    const remove = it.next().value;
                    if (remove)
                        seenIds.delete(remove);
                }
            }
            return oc8Result;
        }
    }
    catch (e) {
        throw e;
    }
    // 2) Fallback: PNG text oc8 checksum mode (encoder may store compressed payload in RGB)
    const compressed = rgbCompressedBuffer();
    const oc8Text = (png.text && png.text.oc8) ? Number(png.text.oc8) : null;
    if (oc8Text !== null) {
        const calc = crypto.createHash('sha256').update(compressed).digest().subarray(0, 1)[0];
        if (oc8Text !== calc)
            throw new Error('OC8 checksum mismatch');
        const json = zlib_1.default.brotliDecompressSync(compressed);
        const payload = JSON.parse(json.toString('utf8'));
        if (payload && payload.id) {
            if (seenIds.has(payload.id))
                throw new Error('replay detected');
            seenIds.add(payload.id);
            if (seenIds.size > 10000) {
                const it = seenIds.values();
                const remove = it.next().value;
                if (remove)
                    seenIds.delete(remove);
            }
        }
        return payload;
    }
    // 3) Last resort: try to decompress trimmed RGB buffer and parse JSON
    try {
        const json = zlib_1.default.brotliDecompressSync(compressed);
        const payload = JSON.parse(json.toString('utf8'));
        if (payload && payload.id) {
            if (seenIds.has(payload.id))
                throw new Error('replay detected');
            seenIds.add(payload.id);
            if (seenIds.size > 10000) {
                const it = seenIds.values();
                const remove = it.next().value;
                if (remove)
                    seenIds.delete(remove);
            }
        }
        return payload;
    }
    catch (e) {
        throw new Error('Failed to decode cortex PNG: no OC8 header, no oc8 text checksum, and Brotli decompression failed: ' + String(e));
    }
}
exports.default = { decodeCortexPNG };
