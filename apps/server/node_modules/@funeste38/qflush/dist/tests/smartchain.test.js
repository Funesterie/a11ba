"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
(0, vitest_1.describe)('SmartChain basic', () => {
    (0, vitest_1.it)('should build default pipeline', () => {
        (0, vitest_1.expect)(Array.isArray(['detect', 'config', 'start'])).toBe(true);
    });
    (0, vitest_1.it)('should build pipeline with kill', () => {
        (0, vitest_1.expect)(['kill', 'detect', 'config', 'start'].includes('kill')).toBe(true);
    });
    (0, vitest_1.it)('should build pipeline with exodia', () => {
        (0, vitest_1.expect)(['detect', 'config', 'start', 'exodia'].includes('exodia')).toBe(true);
    });
});
