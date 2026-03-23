"use strict";
// ROME-TAG: 0xF66B59
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
exports.fetchWrapper = fetchWrapper;
// small wrapper around available fetch implementations
// tries global fetch, then undici, otherwise falls back to node's http(s) for simple requests
const http = __importStar(require("http"));
const https = __importStar(require("https"));
async function simpleFetch(url, init = {}) {
    return new Promise((resolve, reject) => {
        try {
            const u = new URL(url);
            const isHttps = u.protocol === 'https:';
            const lib = isHttps ? https : http;
            const opts = { method: init.method || 'GET', headers: init.headers || {}, hostname: u.hostname, port: u.port || (isHttps ? 443 : 80), path: u.pathname + (u.search || '') };
            const req = lib.request(opts, (res) => {
                const bufs = [];
                res.on('data', (d) => bufs.push(d));
                res.on('end', () => {
                    const txt = Buffer.concat(bufs).toString('utf8');
                    resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, statusText: res.statusMessage, text: () => Promise.resolve(txt), json: () => Promise.resolve(JSON.parse(txt)), headers: res.headers });
                });
            });
            req.on('error', (e) => reject(e));
            if (init.body)
                req.write(typeof init.body === 'string' ? init.body : JSON.stringify(init.body));
            req.end();
        }
        catch (e) {
            reject(e);
        }
    });
}
async function fetchWrapper(url, init) {
    if (typeof globalThis.fetch === 'function')
        return globalThis.fetch(url, init);
    try {
        // try undici
        const undici = require('undici');
        if (undici && typeof undici.fetch === 'function')
            return undici.fetch(url, init);
    }
    catch (e) {
        // ignore
    }
    return simpleFetch(url, init || {});
}
exports.default = fetchWrapper;
