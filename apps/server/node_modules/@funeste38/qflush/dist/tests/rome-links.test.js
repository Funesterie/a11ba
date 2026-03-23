"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="vitest" />
const linker_js_1 = require("../rome/linker.js");
const vitest_1 = require("vitest");
const projectRoot = process.cwd();
(0, vitest_1.describe)('rome linker resolver', () => {
    (0, vitest_1.it)('resolves tokens using index', () => {
        // this test relies on existing .qflush/rome-index.json in workspace
        const from = 'src/rome/linker.test.ts';
        const token = 'linker';
        const res = (0, linker_js_1.resolveRomeToken)(projectRoot, from, token);
        (0, vitest_1.expect)(res).toBeDefined();
        (0, vitest_1.expect)(res.score).toBeGreaterThanOrEqual(0);
    });
    (0, vitest_1.it)('emits update on mergeAndWrite', async () => {
        const testLinks = [{ from: 'src/a.ts', line: 1, token: 'a', target: null, score: 0 }];
        await new Promise((resolve, reject) => {
            const handler = (updated) => {
                try {
                    (0, vitest_1.expect)(Array.isArray(updated)).toBe(true);
                    linker_js_1.romeLinksEmitter.removeListener('updated', handler);
                    resolve(undefined);
                }
                catch (e) {
                    reject(e);
                }
            };
            linker_js_1.romeLinksEmitter.on('updated', handler);
            (0, linker_js_1.mergeAndWrite)(projectRoot, testLinks);
        });
    });
});
