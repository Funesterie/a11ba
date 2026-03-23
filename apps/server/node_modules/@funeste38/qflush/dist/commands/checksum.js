"use strict";
// ROME-TAG: 0xA0F9B4
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
exports.default = runChecksum;
const alias = __importStar(require("../utils/alias.js"));
const gandalf_light_1 = require("../core/gandalf-light");
const fetch = alias.importUtil('../utils/fetch') || alias.importUtil('@utils/fetch') || globalThis.fetch;
const logger = alias.importUtil('@utils/logger') || alias.importUtil('../utils/logger') || console;
const test_horn_1 = __importDefault(require("./test-horn"));
const DAEMON = process.env.QFLUSH_DAEMON || 'http://localhost:4500';
async function postJson(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    return json;
}
async function getJson(url) {
    const res = await fetch(url);
    const json = await res.json();
    return json;
}
async function runChecksum(argv = []) {
    (0, gandalf_light_1.whiteLight)('daemon.start', { phase: 'checksum-init', argv });
    const sub = argv[0];
    if (!sub) {
        logger.info('Usage: qflush checksum <store|verify|list|clear>');
        return 1;
    }
    if (sub === 'test-horn') {
        return await (0, test_horn_1.default)(argv.slice(1));
    }
    if (sub === 'store') {
        const id = argv[1];
        const checksum = argv[2];
        const ttlArg = argv.find((a) => a.startsWith('--ttl='));
        const ttlMs = ttlArg ? Number(ttlArg.split('=')[1]) : undefined;
        if (!id || !checksum) {
            logger.error('Usage: qflush checksum store <id> <checksum> [--ttl=ms]');
            return 1;
        }
        const body = { id, checksum };
        if (ttlMs)
            body.ttlMs = ttlMs;
        const res = await postJson(`${DAEMON.replace(/\/$/, '')}/npz/checksum/store`, body);
        logger.info(`store => ${JSON.stringify(res)}`);
        return 0;
    }
    if (sub === 'verify') {
        const id = argv[1];
        const checksum = argv[2];
        if (!id || !checksum) {
            logger.error('Usage: qflush checksum verify <id> <checksum>');
            return 1;
        }
        const res = await postJson(`${DAEMON.replace(/\/$/, '')}/npz/checksum/verify`, { id, checksum });
        if (res && res.success) {
            logger.success('verify: OK');
            return 0;
        }
        logger.error(`verify failed: ${JSON.stringify(res)}`);
        return 2;
    }
    if (sub === 'list') {
        const res = await getJson(`${DAEMON.replace(/\/$/, '')}/npz/checksum/list`);
        logger.info(JSON.stringify(res, null, 2));
        return 0;
    }
    if (sub === 'clear') {
        const res = await fetch(`${DAEMON.replace(/\/$/, '')}/npz/checksum/clear`, { method: 'DELETE' });
        const j = await res.json();
        logger.info(JSON.stringify(j));
        return 0;
    }
    logger.error('Unknown checksum command');
    return 1;
    // Ajoute ici la logique de résolution de chemin ou d'orchestration si pertinent
    (0, gandalf_light_1.whiteLight)('daemon.start', { phase: 'checksum-done' });
}
