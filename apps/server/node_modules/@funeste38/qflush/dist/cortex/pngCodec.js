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
exports.encodeCortexPacketToPng = encodeCortexPacketToPng;
exports.decodeCortexPacketFromPng = decodeCortexPacketFromPng;
const pngjs_1 = require("pngjs");
const fs = __importStar(require("fs"));
const zlib = __importStar(require("zlib"));
const MAGIC = Buffer.from('CXPK');
const HEADER_SIZE = 12; // 4 + 1 +3 +4
function encodeCortexPacketToPng(packet, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const json = JSON.stringify(packet);
            const payload = zlib.brotliCompressSync(Buffer.from(json, 'utf8'));
            const header = Buffer.alloc(HEADER_SIZE);
            MAGIC.copy(header, 0); // 0..3
            header.writeUInt8(1, 4); // version
            header.writeUInt8(0, 5);
            header.writeUInt8(0, 6);
            header.writeUInt8(0, 7);
            header.writeUInt32BE(payload.length, 8);
            const rawData = Buffer.concat([header, payload]);
            const redCurtainMode = options.redCurtainMode ?? false;
            const bytesPerPixel = redCurtainMode ? 1 : 4;
            const totalPixels = Math.ceil(rawData.length / bytesPerPixel);
            const width = options.width ?? 8;
            const height = Math.ceil(totalPixels / width);
            const png = new pngjs_1.PNG({ width, height });
            const data = png.data;
            for (let i = 0; i < totalPixels; i++) {
                const pxIndex = i * 4;
                const byteIndex = i * bytesPerPixel;
                if (redCurtainMode) {
                    const value = rawData[byteIndex] ?? 0;
                    data[pxIndex] = value;
                    data[pxIndex + 1] = 0;
                    data[pxIndex + 2] = 0;
                    data[pxIndex + 3] = 255;
                }
                else {
                    data[pxIndex] = rawData[byteIndex] ?? 0;
                    data[pxIndex + 1] = rawData[byteIndex + 1] ?? 0;
                    data[pxIndex + 2] = rawData[byteIndex + 2] ?? 0;
                    data[pxIndex + 3] = rawData[byteIndex + 3] ?? 0;
                }
            }
            // padding
            for (let i = totalPixels * 4; i < data.length; i++)
                data[i] = data[i] || 0;
            const ws = fs.createWriteStream(outputPath);
            png.pack().pipe(ws);
            ws.on('finish', () => resolve());
            ws.on('error', reject);
        }
        catch (e) {
            reject(e);
        }
    });
}
function decodeCortexPacketFromPng(inputPath) {
    return new Promise((resolve, reject) => {
        try {
            const rs = fs.createReadStream(inputPath);
            // pngjs types may not match stream typings in TS env; cast to any for pipe
            rs.pipe(new pngjs_1.PNG())
                .on('parsed', function () {
                try {
                    const data = this.data; // RGBA
                    // attempt red-curtain detection: many pixels with G=B=0 and A=255
                    let redCurtain = true;
                    for (let i = 0; i < data.length; i += 4) {
                        if (!(data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 255)) {
                            redCurtain = false;
                            break;
                        }
                    }
                    let rawData;
                    if (redCurtain) {
                        const bytes = data.length / 4;
                        rawData = Buffer.alloc(bytes);
                        for (let i = 0; i < bytes; i++)
                            rawData[i] = data[i * 4];
                    }
                    else {
                        // take raw RGBA stream
                        rawData = Buffer.from(data);
                    }
                    const magic = rawData.subarray(0, 4);
                    if (!magic.equals(MAGIC))
                        return reject(new Error('Invalid CORTEX PNG, bad MAGIC'));
                    const version = rawData.readUInt8(4);
                    const length = rawData.readUInt32BE(8);
                    const headerSize = HEADER_SIZE;
                    const payloadBytes = rawData.subarray(headerSize, headerSize + length);
                    const decompressed = zlib.brotliDecompressSync(payloadBytes);
                    const jsonString = decompressed.toString('utf8');
                    const packet = JSON.parse(jsonString);
                    if (packet.kind !== 'cortex-packet')
                        return reject(new Error('Invalid cortex packet kind'));
                    resolve(packet);
                }
                catch (e) {
                    reject(e);
                }
            })
                .on('error', reject);
        }
        catch (e) {
            reject(e);
        }
    });
}
