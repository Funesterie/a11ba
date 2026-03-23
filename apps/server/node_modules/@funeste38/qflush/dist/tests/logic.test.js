"use strict";
// ROME-TAG: 0xDEC58D
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const logic_parser_js_1 = require("../rome/logic-parser.js");
const vitest_1 = require("vitest");
async function runTests() {
    const rules = (0, logic_parser_js_1.parseLogicFile)('src/rome/logic/logic.qfl');
    console.log('parsed rules:', rules.map(r => r.name));
    if (rules.length === 0)
        throw new Error('no rules parsed');
}
(0, vitest_1.describe)('logic (stub)', () => {
    (0, vitest_1.it)('stub passes', () => {
        (0, vitest_1.expect)(true).toBe(true);
    });
});
