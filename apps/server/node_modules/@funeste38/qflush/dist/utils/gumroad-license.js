"use strict";
// ROME-TAG: 0xC4BE64
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
exports.saveLicense = saveLicense;
exports.loadLicense = loadLicense;
exports.readTokenFromFile = readTokenFromFile;
exports.verifyWithGumroad = verifyWithGumroad;
exports.isLicenseValid = isLicenseValid;
exports.activateLicense = activateLicense;
exports.clearLicense = clearLicense;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function resolveFetch() {
    if (typeof globalThis.fetch === 'function')
        return globalThis.fetch;
    try {
        const m = await import('node-fetch');
        return (m && m.default) || m;
    }
    catch (e) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const undici = require('undici');
            if (undici && typeof undici.fetch === 'function')
                return undici.fetch;
        }
        catch (_) { }
    }
    throw new Error('No fetch implementation available (install node-fetch or undici)');
}
const DEFAULT_STORAGE = path.join(process.cwd(), '.qflush', 'license.json');
function getStoragePath() {
    return process.env.GUMROAD_LICENSE_PATH || DEFAULT_STORAGE;
}
function ensureDir(storagePath) {
    const dir = path.dirname(storagePath);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
}
function saveLicense(rec) {
    const storage = getStoragePath();
    ensureDir(storage);
    fs.writeFileSync(storage, JSON.stringify(rec, null, 2), 'utf8');
}
function loadLicense() {
    try {
        const storage = getStoragePath();
        if (!fs.existsSync(storage))
            return null;
        const raw = fs.readFileSync(storage, 'utf8');
        return JSON.parse(raw);
    }
    catch (e) {
        return null;
    }
}
function readTokenFromFile() {
    const p = process.env.GUMROAD_TOKEN_FILE;
    if (!p)
        return null;
    try {
        if (!fs.existsSync(p))
            return null;
        return fs.readFileSync(p, 'utf8').trim();
    }
    catch (e) {
        return null;
    }
}
async function verifyWithGumroad(product_id, licenseKey, token) {
    const url = 'https://api.gumroad.com/v2/licenses/verify';
    const body = { product_id, license_key: licenseKey };
    const fetch = await resolveFetch();
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(`Gumroad API returned ${res.status}`);
    const json = await res.json();
    return json;
}
function isLicenseValid(rec) {
    if (!rec)
        return false;
    if (rec.expiresAt && Date.now() > rec.expiresAt)
        return false;
    return true;
}
async function activateLicense(product_id, licenseKey, token) {
    const data = await verifyWithGumroad(product_id, licenseKey, token);
    if (data && data.success) {
        const purchase = data.purchase || {};
        const now = Date.now();
        const recurring = !!purchase.subscription_ended_at || !!purchase.subscription_cancelled_at ? false : !!purchase.subscription_id;
        const expiresAt = recurring ? null : now + 365 * 24 * 3600 * 1000; // 1 year default
        const rec = {
            key: licenseKey,
            product_id,
            createdAt: now,
            expiresAt,
            recurring,
            lastVerified: now,
            metadata: purchase,
        };
        saveLicense(rec);
        return rec;
    }
    throw new Error('License verification failed');
}
function clearLicense() {
    try {
        const storage = getStoragePath();
        if (fs.existsSync(storage))
            fs.unlinkSync(storage);
    }
    catch (e) { }
}
exports.default = { saveLicense, loadLicense, verifyWithGumroad, activateLicense, isLicenseValid, clearLicense, readTokenFromFile };
