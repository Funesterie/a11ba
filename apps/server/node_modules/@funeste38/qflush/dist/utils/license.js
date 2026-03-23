"use strict";
// ROME-TAG: 0x3C04E4
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
exports.readLicense = readLicense;
exports.saveLicense = saveLicense;
exports.activateLicense = activateLicense;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// do not statically import node-fetch (may be ESM); use dynamic import when needed
const STORE = path.join(process.cwd(), '.qflush', 'license.json');
function ensureDir() {
    const dir = path.dirname(STORE);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
}
function readLicense() {
    try {
        if (!fs.existsSync(STORE))
            return null;
        const raw = fs.readFileSync(STORE, 'utf8');
        return JSON.parse(raw);
    }
    catch (e) {
        return null;
    }
}
function saveLicense(rec) {
    try {
        ensureDir();
        fs.writeFileSync(STORE, JSON.stringify(rec, null, 2), 'utf8');
        return true;
    }
    catch (e) {
        return false;
    }
}
async function verifyWithGumroad(key, productId) {
    const token = process.env.GUMROAD_TOKEN;
    if (!token)
        throw new Error('GUMROAD_TOKEN not configured');
    const url = `https://api.gumroad.com/v2/licenses/verify`;
    const body = new URLSearchParams();
    body.append('product_permalink', productId || '');
    body.append('license_key', key);
    // Dynamic import to support both CJS and ESM environments
    let fetchFn = undefined;
    try {
        const m = await import('node-fetch');
        fetchFn = (m && m.default) || m;
    }
    catch (e) {
        // node-fetch not available or cannot be imported; try global fetch / undici fallback handled by caller
        try {
            // try undici dynamic require as fallback
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const undici = require('undici');
            if (undici && typeof undici.fetch === 'function')
                fetchFn = undici.fetch;
        }
        catch (_) {
            // ignore
        }
    }
    if (!fetchFn && typeof globalThis.fetch === 'function')
        fetchFn = globalThis.fetch;
    if (!fetchFn)
        throw new Error('No fetch implementation available (install node-fetch or undici)');
    const res = await fetchFn(url, { method: 'POST', body, headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    return json;
}
async function activateLicense(key, productId) {
    const resp = await verifyWithGumroad(key, productId);
    if (resp && resp.success) {
        const purchase = resp.purchase || {};
        const lic = { key, product_id: purchase.product_id || productId, valid: true, expires_at: purchase ? purchase.license_expires_at : null, verifiedAt: Date.now() };
        saveLicense(lic);
        return { ok: true, license: lic, raw: resp };
    }
    // failure
    const lic = { key, product_id: productId, valid: false, verifiedAt: Date.now() };
    saveLicense(lic);
    return { ok: false, error: resp };
}
exports.default = { readLicense, saveLicense, activateLicense };
