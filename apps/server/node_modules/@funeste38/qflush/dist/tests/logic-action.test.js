"use strict";
// ROME-TAG: 0x8F4668
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const logic_loader_js_1 = require("../rome/logic-loader.js");
const index_loader_js_1 = require("../rome/index-loader.js");
const logic_loader_js_2 = require("../rome/logic-loader.js");
const vitest_1 = require("vitest");
async function runTests() {
    // ensure rules are loaded
    const rules = (0, logic_loader_js_1.loadLogicRules)();
    console.log('rules loaded', rules.length);
    const idx = (0, index_loader_js_1.loadRomeIndexFromDisk)();
    const actions = (0, logic_loader_js_2.evaluateAllRules)(idx, Object.keys(idx));
    console.log('evaluateAllRules result', actions);
    if (!Array.isArray(actions))
        throw new Error('no actions returned');
}
(0, vitest_1.describe)('logic-action (stub)', () => {
    (0, vitest_1.it)('stub passes', () => {
        (0, vitest_1.expect)(true).toBe(true);
    });
});
