"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
(0, vitest_1.describe)('cortex/router handlers', () => {
    (0, vitest_1.beforeEach)(() => { try {
        vitest_1.vi.restoreAllMocks();
        delete globalThis.__importUtilMock;
    }
    catch (e) { } });
    (0, vitest_1.it)('npz-graph handler calls executor', async () => {
        const fakeExec = { executeAction: vitest_1.vi.fn(async (a, b) => ({ success: true, action: a, ctx: b })) };
        globalThis.__importUtilMock = (name) => {
            if (name.includes('executor'))
                return fakeExec;
            return undefined;
        };
        const router = await import('./router.js');
        const pkt = { type: 'cortex:npz-graph', payload: { path: 'some/path' } };
        const res = await router.routeCortexPacket(pkt);
        (0, vitest_1.expect)(res && res.success).toBe(true);
        (0, vitest_1.expect)(fakeExec.executeAction.mock.calls.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('vision handler calls vision.processVisionImage', async () => {
        const fakeVision = { processVisionImage: vitest_1.vi.fn(async (p) => ({ ok: true, path: p })) };
        globalThis.__importUtilMock = (name) => {
            if (name.includes('vision'))
                return fakeVision;
            return undefined;
        };
        const router = await import('./router.js');
        const pkt = { type: 'cortex:spyder-vision', payload: { path: 'img.png' } };
        const res = await router.routeCortexPacket(pkt);
        (0, vitest_1.expect)(res && res.ok).toBe(true);
        (0, vitest_1.expect)(fakeVision.processVisionImage.mock.calls.length).toBe(1);
    });
    (0, vitest_1.it)('apply handler calls applyCortexPacket', async () => {
        const fakeApply = { applyCortexPacket: vitest_1.vi.fn(async (p) => ({ ok: true })) };
        globalThis.__importUtilMock = (name) => {
            if (name.includes('applyPacket'))
                return fakeApply;
            return undefined;
        };
        const router = await import('./router.js');
        const pkt = { type: 'qflush:apply', payload: { patch: {} } };
        const res = await router.routeCortexPacket(pkt);
        (0, vitest_1.expect)(res && res.ok).toBe(true);
        (0, vitest_1.expect)(fakeApply.applyCortexPacket.mock.calls.length).toBe(1);
    });
});
