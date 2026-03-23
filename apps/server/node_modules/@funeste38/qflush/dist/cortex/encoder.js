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
exports.encodeCortexCommand = encodeCortexCommand;
const fs_1 = __importDefault(require("fs"));
const path = __importStar(require("path"));
const zlib_1 = __importDefault(require("zlib"));
const pngjs_1 = require("pngjs");
const crypto_1 = __importDefault(require("crypto"));
function encodeCortexCommand(ner, outPath) {
    const json = Buffer.from(JSON.stringify(ner), 'utf8');
    const compressed = zlib_1.default.brotliCompressSync(json, { params: { [zlib_1.default.constants.BROTLI_PARAM_QUALITY]: 11 } });
    const pixelsCount = Math.ceil(compressed.length / 3);
    const width = Math.ceil(Math.sqrt(pixelsCount));
    const height = width;
    const png = new pngjs_1.PNG({ width, height });
    let byteIndex = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const k = (width * y + x) << 2;
            const r = compressed[byteIndex++] ?? 0;
            const g = compressed[byteIndex++] ?? 0;
            const b = compressed[byteIndex++] ?? 0;
            png.data[k] = r;
            png.data[k + 1] = g;
            png.data[k + 2] = b;
            png.data[k + 3] = 255;
        }
    }
    // OC8: first byte of sha256 of compressed payload (simple integrity tag)
    const oc8 = crypto_1.default.createHash('sha256').update(compressed).digest().subarray(0, 1)[0];
    // store as tEXt chunk
    // @ts-ignore png.text exists on PNG
    png.text = png.text || {};
    // store numeric oc8 as string
    // @ts-ignore
    png.text.oc8 = String(oc8);
    // ensure parent dir
    fs_1.default.mkdirSync(path.dirname(outPath), { recursive: true });
    const ws = fs_1.default.createWriteStream(outPath + '.tmp');
    png.pack().pipe(ws);
    ws.on('finish', () => {
        try {
            fs_1.default.renameSync(outPath + '.tmp', outPath);
        }
        catch (e) {
            // best effort
            if (fs_1.default.existsSync(outPath + '.tmp'))
                fs_1.default.unlinkSync(outPath + '.tmp');
        }
    });
}
