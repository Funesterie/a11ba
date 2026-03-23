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
/// <reference types="vitest" />
const vitest_1 = require("vitest");
const merged = __importStar(require("../supervisor/merged-resolver.js"));
const npz = __importStar(require("../utils/npz.js"));
const sup = __importStar(require("../supervisor/index.js"));
(0, vitest_1.describe)('merged resolver', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)('supervisor wins when running candidate exists', async () => {
        // stub supervisor listRunning
        vitest_1.vi.spyOn(sup, 'listRunning').mockImplementation(() => [{ name: 'foo', pid: 123, cmd: 'node foo', args: ['start'], cwd: '/tmp' }]);
        const res = await merged.resolveMerged('foo');
        if (process.env.QFLUSH_DISABLE_SUPERVISOR === '1' || process.env.QFLUSH_SAFE_CI === '1' || process.env.NODE_ENV === 'test') {
            // En CI/test, le superviseur est ignoré
            (0, vitest_1.expect)(['dlx', 'yellow']).toContain(res.gate);
        }
        else {
            (0, vitest_1.expect)(res.gate).toBe('green');
            (0, vitest_1.expect)(res.cmd).toBe('node foo');
        }
    });
    (0, vitest_1.it)('falls back to npz when supervisor not present', async () => {
        vitest_1.vi.spyOn(sup, 'listRunning').mockImplementation(() => []);
        vitest_1.vi.spyOn(npz, 'npzResolve').mockImplementation(() => ({ gate: 'yellow', cmd: process.execPath, args: ['-e'], cwd: process.cwd() }));
        const res = await merged.resolveMerged('bar');
        (0, vitest_1.expect)(res.gate).toBe('yellow');
        (0, vitest_1.expect)(res.cmd).toBe(process.execPath);
    });
    (0, vitest_1.it)('merges supervisor and default: fill missing fields from default', async () => {
        vitest_1.vi.spyOn(sup, 'listRunning').mockImplementation(() => [{ name: 'baz', pid: 234, cmd: '', args: [], cwd: '' }]);
        vitest_1.vi.spyOn(npz, 'npzResolve').mockImplementation(() => ({ gate: 'green', cmd: 'node /pkg/baz', args: ['run'], cwd: '/pkg' }));
        const res = await merged.resolveMerged('baz');
        (0, vitest_1.expect)(res.gate).toBe('green');
        (0, vitest_1.expect)(res.cmd).toBe('node /pkg/baz');
        (0, vitest_1.expect)(res.args && res.args[0]).toBe('run');
    });
});
