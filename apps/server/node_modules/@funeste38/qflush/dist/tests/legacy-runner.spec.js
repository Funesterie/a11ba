"use strict";
/// <reference types="vitest" />
// ROME-TAG: 0x1EC911
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
const vitest_1 = require("vitest");
// import { startServer, stopServer } from '../daemon/qflushd';
const fs_1 = __importDefault(require("fs"));
const path = __importStar(require("path"));
const TEST_DIR = path.join(__dirname);
(0, vitest_1.describe)('legacy test runner', () => {
    const files = fs_1.default.readdirSync(TEST_DIR).filter((f) => f.endsWith('.test.ts') && f !== 'legacy-runner.spec.ts');
    for (const file of files) {
        test(`run ${file}`, async () => {
            const p = path.join(TEST_DIR, file);
            try {
                // dynamic import so vitest handles TS transpilation
                const mod = await import(p);
                if (mod && typeof mod.runTests === 'function') {
                    await mod.runTests();
                }
            }
            catch (err) {
                throw err;
            }
        });
    }
});
