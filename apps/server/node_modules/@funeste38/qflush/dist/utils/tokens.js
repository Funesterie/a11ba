"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.resolveTokens = resolveTokens;
const crypto_1 = require("crypto");
function generateToken(len = 24) {
    return (0, crypto_1.randomBytes)(len).toString("hex");
}
function resolveTokens(existing = {}) {
    const out = {};
    for (const name of ["A-11", "SPYDER", "BAT", "KEYKEY", "NEZLEPHANT"]) {
        out[name] = existing[name] || generateToken(12);
    }
    return out;
}
