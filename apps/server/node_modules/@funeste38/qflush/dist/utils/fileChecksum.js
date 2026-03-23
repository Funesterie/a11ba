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
exports.xorChecksum = xorChecksum;
exports.checksumBufferIgnoringRomeTag = checksumBufferIgnoringRomeTag;
exports.checksumFileIgnoringRomeTag = checksumFileIgnoringRomeTag;
exports.flexibleChecksumBuffer = flexibleChecksumBuffer;
exports.flexibleChecksumFile = flexibleChecksumFile;
const fs = __importStar(require("fs"));
const normalize_js_1 = __importDefault(require("./normalize.js"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
// Note: keep local xor implementation to avoid circular import issues
function xorChecksum(buffer) {
    let x = 0;
    for (let i = 0; i < buffer.length; i++)
        x ^= buffer[i];
    return x & 0xff;
}
function checksumBufferIgnoringRomeTag(buf) {
    // normalize by removing ROME-TAG lines from UTF-8 interpretation
    const text = Buffer.isBuffer(buf) ? buf.toString('utf8') : Buffer.from(buf).toString('utf8');
    const cleaned = normalize_js_1.default.stripRomeTagLines(text);
    const b = Buffer.from(cleaned, 'utf8');
    return xorChecksum(b);
}
function checksumFileIgnoringRomeTag(filePath) {
    const raw = fs.readFileSync(filePath);
    return checksumBufferIgnoringRomeTag(raw);
}
// Flexible checksum: try multiple decoding strategies
async function flexibleChecksumBuffer(buf) {
    const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    // 1) PNG detection (PNG file signature: 89 50 4E 47 0D 0A 1A 0A)
    try {
        if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            // write to temp file and try to decode via existing pngCodec
            try {
                const tmp = path.join(os.tmpdir(), `qflush_cxpk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`);
                fs.writeFileSync(tmp, buffer);
                try {
                    // dynamic import to avoid circular deps
                    const pngCodec = require('../cortex/pngCodec');
                    if (pngCodec && typeof pngCodec.decodeCortexPacketFromPng === 'function') {
                        const pkt = await pngCodec.decodeCortexPacketFromPng(tmp);
                        try {
                            fs.unlinkSync(tmp);
                        }
                        catch (e) {
                            console.warn('[fileChecksum] unlink tmp failed', String(e));
                        }
                        // use payload or whole packet JSON
                        const target = pkt && pkt.payload ? pkt.payload : pkt;
                        const json = JSON.stringify(target);
                        return xorChecksum(Buffer.from(json, 'utf8'));
                    }
                }
                catch (e) {
                    try {
                        fs.unlinkSync(tmp);
                    }
                    catch (e2) {
                        console.warn('[fileChecksum] unlink tmp failed', String(e2));
                    }
                    console.warn('[fileChecksum] png decode attempt failed', String(e));
                }
            }
            catch (e) {
                // ignore and fallback, but record for diagnostics
                console.warn('[fileChecksum] png detection fallback', String(e));
            }
        }
    }
    catch (e) {
        console.warn('[fileChecksum] png detection outer error', String(e));
    }
    // 2) Cortex binary packet (try parse via src/cortex/codec)
    try {
        const codec = require('../cortex/codec');
        if (codec && typeof codec.decodeCortexPacket === 'function') {
            try {
                const parsed = codec.decodeCortexPacket(buffer);
                if (parsed && parsed.payload) {
                    const json = typeof parsed.payload === 'string' ? parsed.payload : JSON.stringify(parsed.payload);
                    return xorChecksum(Buffer.from(json, 'utf8'));
                }
            }
            catch (e) {
                // not a cortex binary packet, continue
                console.warn('[fileChecksum] codec decode failed', String(e));
            }
        }
    }
    catch (e) {
        console.warn('[fileChecksum] cortex codec require failed', String(e));
    }
    // 3) fallback to text normalization checksum
    try {
        return checksumBufferIgnoringRomeTag(buffer);
    }
    catch (e) {
        // last resort: plain xor on raw bytes
        return xorChecksum(buffer);
    }
}
async function flexibleChecksumFile(filePath) {
    const raw = fs.readFileSync(filePath);
    return flexibleChecksumBuffer(raw);
}
exports.default = { xorChecksum, checksumBufferIgnoringRomeTag, checksumFileIgnoringRomeTag, flexibleChecksumBuffer, flexibleChecksumFile };
