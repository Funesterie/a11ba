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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const listener_js_1 = require("./listener.js");
// Sketch: simulate placing a decoded JSON packet file (already extracted) into canal
(0, vitest_1.describe)('Cortex listener (integration sketch)', () => {
    const CANAL = path.join(process.cwd(), 'canal');
    const SPY_CFG = path.join(process.cwd(), '.qflush', 'spyder.config.json');
    (0, vitest_1.beforeEach)(() => {
        if (!fs.existsSync(CANAL))
            fs.mkdirSync(CANAL, { recursive: true });
        if (fs.existsSync(SPY_CFG))
            fs.unlinkSync(SPY_CFG);
    });
    (0, vitest_1.afterEach)(() => {
        try {
            if (fs.existsSync(SPY_CFG))
                fs.unlinkSync(SPY_CFG);
        }
        catch (e) { }
    });
    (0, vitest_1.it)('should create spyder config when receiving enable-spyder packet (sketch)', async () => {
        // This is a sketch: actual test would write PNG parts into canal and wait for listener to process
        // For now assert that listener function exists and can be started
        (0, vitest_1.expect)(typeof listener_js_1.startCortexListener).toBe('function');
    });
});
