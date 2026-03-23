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
exports.cortexEmit = cortexEmit;
exports.onCortexEvent = onCortexEvent;
const events_1 = require("events");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const emitter = new events_1.EventEmitter();
const QFLUSH_DIR = path.join(process.cwd(), '.qflush');
const DRIP_LOG = path.join(QFLUSH_DIR, 'cortex', 'drip.log');
function cortexEmit(eventName, payload) {
    try {
        if (!fs.existsSync(path.dirname(DRIP_LOG)))
            fs.mkdirSync(path.dirname(DRIP_LOG), { recursive: true });
        const line = JSON.stringify({ t: new Date().toISOString(), event: eventName, payload });
        fs.appendFileSync(DRIP_LOG, line + '\n', 'utf8');
    }
    catch (e) {
        console.warn('[cortex] drip log write failed', String(e));
    }
    try {
        emitter.emit(eventName, payload);
    }
    catch (e) {
        console.warn('[cortex] emitter.emit failed', String(e));
    }
}
function onCortexEvent(eventName, cb) {
    emitter.on(eventName, cb);
}
exports.default = { cortexEmit, onCortexEvent };
