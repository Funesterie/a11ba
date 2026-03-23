"use strict";
// Lightweight adapter for A-11 usage from cortex
// Keeps cortex code pure: cortex calls adapter functions which encapsulate IO via core/a11Client
Object.defineProperty(exports, "__esModule", { value: true });
exports.isA11Available = isA11Available;
exports.askA11 = askA11;
let a11 = null;
try {
    a11 = require('../core/a11Client');
}
catch (e) {
    try {
        a11 = require('../../dist/core/a11Client');
    }
    catch (_e) {
        a11 = null;
    }
}
async function isA11Available() {
    if (!a11 || !a11.a11Health)
        return { ok: false, reason: 'client_unavailable' };
    try {
        const h = await a11.a11Health();
        return { ok: !!(h && h.ok), detail: h };
    }
    catch (e) {
        return { ok: false, reason: String(e) };
    }
}
async function askA11(prompt, opts) {
    if (!a11 || !a11.a11Chat)
        throw new Error('A-11 client not available');
    return a11.a11Chat(prompt, opts);
}
