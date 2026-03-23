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
exports.crc8_oc8 = crc8_oc8;
exports.buildCortexPacket = buildCortexPacket;
exports.parseCortexPacket = parseCortexPacket;
exports.encodePacketToPNGs = encodePacketToPNGs;
exports.decodePNGsToPacket = decodePNGsToPacket;
exports.encodeFileToPNGs = encodeFileToPNGs;
exports.decodePNGsToFile = decodePNGsToFile;
exports.decodeCortexPacket = decodeCortexPacket;
const fs = __importStar(require("fs"));
const zlib = __importStar(require("zlib"));
const sharp_1 = __importDefault(require("sharp"));
const brotliCompressSync = (input) => zlib.brotliCompressSync(input, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });
const brotliDecompressSync = (input) => zlib.brotliDecompressSync(input);
// CRC-8 OC8 implementation
function crc8_oc8(data, poly = 0x07, init = 0x00) {
    let crc = init & 0xff;
    for (const b of data) {
        crc ^= b;
        for (let i = 0; i < 8; i++) {
            if ((crc & 0x80) !== 0)
                crc = ((crc << 1) ^ poly) & 0xff;
            else
                crc = (crc << 1) & 0xff;
        }
    }
    return crc & 0xff;
}
function buildCortexPacket(raw, flags = 0) {
    const compressed = brotliCompressSync(raw);
    const crc = crc8_oc8(compressed);
    const payload = Buffer.concat([compressed, Buffer.from([crc])]);
    const payloadLen = payload.length;
    const totalLen = payloadLen + 16;
    const header = Buffer.alloc(16);
    header.writeUInt32BE(totalLen, 0);
    header.writeUInt32BE(payloadLen, 4);
    header.writeUInt8(flags & 0xff, 8);
    // reserved 7 bytes already zero
    return Buffer.concat([header, payload]);
}
function parseCortexPacket(buf) {
    if (buf.length < 16)
        throw new Error('Stream too short for Cortex header');
    const totalLen = buf.readUInt32BE(0);
    const payloadLen = buf.readUInt32BE(4);
    const flags = buf.readUInt8(8);
    if (payloadLen < 1)
        throw new Error('invalid payload length');
    if (buf.length < 16 + payloadLen)
        throw new Error('buffer shorter than payload');
    const payloadWithCrc = buf.slice(16, 16 + payloadLen);
    const compressed = payloadWithCrc.slice(0, -1);
    const crc = payloadWithCrc[payloadWithCrc.length - 1];
    const expected = crc8_oc8(compressed);
    if (crc !== expected)
        throw new Error(`CRC mismatch: expected ${expected}, got ${crc}`);
    const raw = brotliDecompressSync(compressed);
    return { totalLen, payloadLen, flags, raw };
}
function padToMultipleOf3(buf) {
    const pad = (3 - (buf.length % 3)) % 3;
    if (pad === 0)
        return buf;
    return Buffer.concat([buf, Buffer.alloc(pad)]);
}
async function encodePacketToPNGs(packet, outputPrefix, maxPngBytes = 200 * 1024 * 1024) {
    const rgb = padToMultipleOf3(packet);
    const totalPixels = Math.floor(rgb.length / 3);
    const maxPixelsPerImg = Math.max(1, Math.floor(maxPngBytes / 3));
    const numImages = Math.max(1, Math.ceil(totalPixels / maxPixelsPerImg));
    const outPaths = [];
    let pixelOffset = 0;
    for (let idx = 0; idx < numImages; idx++) {
        const pixelsInChunk = Math.min(maxPixelsPerImg, totalPixels - pixelOffset);
        if (pixelsInChunk <= 0)
            break;
        const start = pixelOffset * 3;
        const end = start + pixelsInChunk * 3;
        const chunk = rgb.slice(start, end);
        // compute dims
        const width = Math.min(4096, Math.max(1, Math.round(Math.sqrt(pixelsInChunk))));
        const height = Math.ceil(pixelsInChunk / width);
        const required = width * height * 3;
        let data = chunk;
        if (required > chunk.length)
            data = Buffer.concat([chunk, Buffer.alloc(required - chunk.length)]);
        const outName = `${outputPrefix}_part${idx.toString().padStart(2, '0')}.png`;
        // sharp expects raw with channels=3
        await (0, sharp_1.default)(data, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 1 }).toFile(outName);
        outPaths.push(outName);
        pixelOffset += pixelsInChunk;
    }
    return outPaths;
}
async function decodePNGsToPacket(paths) {
    // read in order, extract raw RGB bytes
    const parts = [];
    for (const p of paths) {
        const res = await (0, sharp_1.default)(p).raw().toBuffer({ resolveWithObject: true });
        let { data, info } = res;
        if (info.channels === 4) {
            // strip alpha
            const stripped = Buffer.alloc((data.length / 4) * 3);
            let j = 0;
            for (let i = 0; i < data.length; i += 4) {
                stripped[j++] = data[i];
                stripped[j++] = data[i + 1];
                stripped[j++] = data[i + 2];
            }
            data = stripped;
        }
        else if (info.channels === 3) {
            // ok
        }
        else {
            // attempt to convert to rgb buffer
            const rgbBuf = await (0, sharp_1.default)(p).ensureAlpha().raw().toBuffer();
            // then strip
            const stripped = Buffer.alloc((rgbBuf.length / 4) * 3);
            let j = 0;
            for (let i = 0; i < rgbBuf.length; i += 4) {
                stripped[j++] = rgbBuf[i];
                stripped[j++] = rgbBuf[i + 1];
                stripped[j++] = rgbBuf[i + 2];
            }
            data = stripped;
        }
        parts.push(data);
    }
    const full = Buffer.concat(parts);
    // no padding removal necessary: parse header and payload lengths
    return full;
}
// Convenience helpers for file io
async function encodeFileToPNGs(inputPath, outputPrefix) {
    const raw = fs.readFileSync(inputPath);
    const packet = buildCortexPacket(raw, 0);
    return encodePacketToPNGs(packet, outputPrefix);
}
async function decodePNGsToFile(pngGlobPaths, outputPath) {
    const full = await decodePNGsToPacket(pngGlobPaths);
    const parsed = parseCortexPacket(full);
    fs.writeFileSync(outputPath, parsed.raw);
}
function decodeCortexPacket(buf) {
    // parseCortexPacket already verifies CRC and decompresses
    const parsed = parseCortexPacket(buf);
    let payload = null;
    try {
        const txt = parsed.raw.toString('utf-8');
        payload = JSON.parse(txt);
    }
    catch (e) {
        payload = parsed.raw;
    }
    return {
        totalLen: parsed.totalLen,
        payloadLen: parsed.payloadLen,
        flags: parsed.flags,
        payload
    };
}
exports.default = { buildCortexPacket, parseCortexPacket, decodeCortexPacket, encodePacketToPNGs, decodePNGsToPacket };
