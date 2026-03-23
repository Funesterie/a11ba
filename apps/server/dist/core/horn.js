"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHorn = registerHorn;
exports.scream = scream;
// Simple registry for demonstration
const horns = {};
function registerHorn(name, fn) {
    horns[name] = fn;
}
async function scream(name, payload) {
    if (horns[name]) {
        return await horns[name](payload);
    }
    throw new Error(`Horn '${name}' not registered.`);
}
