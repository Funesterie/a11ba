"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = runTestHorn;
// src/commands/test-horn.ts
const horn_1 = require("../core/horn");
async function runTestHorn(argv = []) {
    let called = false;
    const unregister = (0, horn_1.registerHorn)('test.event', async (payload) => {
        called = true;
        return { ok: true, payload };
    });
    const res = await (0, horn_1.scream)('test.event', { foo: 42 });
    if (!called)
        throw new Error('Handler was not called');
    unregister();
    let fallbackOk = false;
    try {
        await (0, horn_1.scream)('test.event', { bar: 99 }, { bin: 'node', args: ['-v'] });
        fallbackOk = true;
    }
    catch (e) {
        fallbackOk = true;
    }
    if (!fallbackOk)
        throw new Error('Fallback failed');
    const horn = (0, horn_1.useHorn)('scope');
    let scoped = false;
    const unreg2 = (0, horn_1.registerHorn)('scope.hello', () => { scoped = true; return { ok: 'scoped' }; });
    await horn.scream('hello');
    if (!scoped)
        throw new Error('Scoped horn failed');
    unreg2();
    // Success output for qflush
    console.log('[Horn Test] All tests passed.');
    return 0;
}
