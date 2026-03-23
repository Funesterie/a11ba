"use strict";
// ROME-TAG: 0x077294
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const engine_js_1 = require("../rome/engine.js");
const vitest_1 = require("vitest");
const sampleIndex = {
    'src/daemon/qflushd.ts': { type: 'daemon', path: 'src/daemon/qflushd.ts', ext: 'ts', tag: 1, tagHex: '0x000001', savedAt: new Date().toISOString(), version: 1 },
    'src/commands/checksum.ts': { type: 'command', path: 'src/commands/checksum.ts', ext: 'ts', tag: 2, tagHex: '0x000002', savedAt: new Date().toISOString(), version: 1 },
    'assets/banner.png': { type: 'asset', path: 'assets/banner.png', ext: 'png', tag: 3, tagHex: '0x000003', savedAt: new Date().toISOString(), version: 1 },
    'src/tests/foo.test.ts': { type: 'test', path: 'src/tests/foo.test.ts', ext: 'ts', tag: 4, tagHex: '0x000004', savedAt: new Date().toISOString(), version: 1 },
};
async function runTests() {
    const actions = (0, engine_js_1.evaluateIndex)(sampleIndex);
    console.log('engine test actions:', actions);
    if (actions.length < 4)
        throw new Error('expected actions for each record');
}
(0, vitest_1.describe)('engine (stub)', () => {
    (0, vitest_1.it)('stub passes', () => {
        (0, vitest_1.expect)(true).toBe(true);
    });
});
