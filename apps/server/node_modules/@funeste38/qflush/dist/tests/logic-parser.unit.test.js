"use strict";
// ROME-TAG: 0xE77814
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const logic_parser_js_1 = require("../rome/logic-parser.js");
const vitest_1 = require("vitest");
function testExpr(expr, ctx, expected) {
    const ast = (0, logic_parser_js_1.buildConditionAst)(expr);
    const res = (0, logic_parser_js_1.evaluateConditionExprAST)(ast, ctx);
    if (res !== expected) {
        console.error('test failed', expr, ctx, res, expected);
        throw new Error(`logic-parser test failed: ${expr}`);
    }
}
async function runTests() {
    testExpr('file.type == "module" and file.tagChanged', { file: { type: 'module', tagChanged: true } }, true);
    testExpr('file.type == "module" and not file.tagChanged', { file: { type: 'module', tagChanged: false } }, true);
    testExpr('file.type == "asset" or file.type == "module"', { file: { type: 'module' } }, true);
    console.log('logic-parser unit tests passed');
}
(0, vitest_1.describe)('logic-parser (stub)', () => {
    (0, vitest_1.it)('stub passes', () => {
        (0, vitest_1.expect)(true).toBe(true);
    });
});
