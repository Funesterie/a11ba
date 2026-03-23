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
const vitest_1 = require("vitest");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("path"));
const net = __importStar(require("node:net"));
const node_os_1 = __importDefault(require("node:os"));
(0, vitest_1.describe)('spyder admin port occupied behavior', () => {
    let tmpDir;
    let origCwd;
    const OLD_ENV = { ...process.env };
    let server = null;
    (0, vitest_1.beforeEach)(() => {
        origCwd = process.cwd();
        tmpDir = fs.mkdtempSync(path.join(node_os_1.default.tmpdir(), 'qflush-test-'));
        process.chdir(tmpDir);
    });
    (0, vitest_1.afterEach)(() => {
        try {
            process.chdir(origCwd);
        }
        catch (err) { /* ignore */ }
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        catch (err) { /* ignore */ }
        process.env = { ...OLD_ENV };
        if (server) {
            try {
                server.close();
            }
            catch (err) { /* ignore */ }
            server = null;
        }
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)('does not persist spyder config when admin port is already bound', async () => {
        // reserve a port
        const listenPort = 52345;
        server = net.createServer(() => { });
        await new Promise((resolve, reject) => {
            server.listen(listenPort, '127.0.0.1', (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        process.env.QFLUSH_SPYDER_ADMIN_PORT = String(listenPort);
        // mock startService to avoid side effects
        vitest_1.vi.mock('../../src/services', () => ({ startService: async () => { return; } }));
        const { runStart } = await import('../../src/commands/start.js');
        await runStart({ services: ['spyder'], flags: {} });
        const cfgPath = path.join(process.cwd(), '.qflush', 'spyder.config.json');
        (0, vitest_1.expect)(fs.existsSync(cfgPath)).toBe(false);
    });
});
