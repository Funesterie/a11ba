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
exports.loadRoutesConfig = loadRoutesConfig;
exports.isRouteEnabled = isRouteEnabled;
exports.getRouteScore = getRouteScore;
exports.pickBestRoute = pickBestRoute;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ROUTES_PATH = path.join(process.cwd(), '.qflush', 'cortex.routes.json');
function loadRoutesConfig() {
    try {
        if (!fs.existsSync(ROUTES_PATH))
            return null;
        const raw = fs.readFileSync(ROUTES_PATH, 'utf8') || '{}';
        const parsed = JSON.parse(raw);
        // support two shapes: { routes: [...] } or { cortexActions: { name: true } } or object map
        if (parsed && parsed.routes && Array.isArray(parsed.routes)) {
            const out = {};
            for (const r of parsed.routes)
                out[r] = { enabled: true, score: 0 };
            return out;
        }
        if (parsed && parsed.cortexActions && typeof parsed.cortexActions === 'object' && !Array.isArray(parsed.cortexActions)) {
            const out = {};
            for (const [k, v] of Object.entries(parsed.cortexActions)) {
                if (typeof v === 'boolean')
                    out[k] = { enabled: v, score: 0 };
                else
                    out[k] = v;
            }
            return out;
        }
        if (parsed && typeof parsed === 'object') {
            // assume mapping directly
            return parsed;
        }
        return null;
    }
    catch (e) {
        return null;
    }
}
function isRouteEnabled(name) {
    try {
        const cfg = loadRoutesConfig();
        if (!cfg)
            return true; // default allow
        const entry = cfg[name];
        if (!entry)
            return true;
        if (typeof entry.enabled === 'boolean')
            return entry.enabled;
        return true;
    }
    catch (e) {
        return true;
    }
}
function getRouteScore(name) {
    try {
        const cfg = loadRoutesConfig();
        if (!cfg)
            return 0;
        const entry = cfg[name];
        if (!entry)
            return 0;
        const s = Number(entry.score || 0);
        return Number.isFinite(s) ? s : 0;
    }
    catch (e) {
        return 0;
    }
}
function pickBestRoute(candidates) {
    if (!candidates || !candidates.length)
        return null;
    const scores = candidates.map(n => ({ name: n, score: getRouteScore(n) }));
    // filter enabled
    const enabled = scores.filter(s => isRouteEnabled(s.name));
    if (!enabled.length)
        return null;
    enabled.sort((a, b) => b.score - a.score);
    return enabled[0].name;
}
exports.default = { loadRoutesConfig, isRouteEnabled, getRouteScore, pickBestRoute };
