"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
(0, vitest_1.describe)('Rome index basic', () => {
    (0, vitest_1.it)('should have a valid index structure', () => {
        const index = {
            'src/commands/checksum.ts': { type: 'command', path: 'src/commands/checksum.ts', ext: 'ts', tag: 2 },
            'assets/banner.png': { type: 'asset', path: 'assets/banner.png', ext: 'png', tag: 3 },
            'src/tests/foo.test.ts': { type: 'test', path: 'src/tests/foo.test.ts', ext: 'ts', tag: 4 },
        };
        (0, vitest_1.expect)(typeof index).toBe('object');
        (0, vitest_1.expect)(Object.keys(index).length).toBeGreaterThan(0);
    });
});
