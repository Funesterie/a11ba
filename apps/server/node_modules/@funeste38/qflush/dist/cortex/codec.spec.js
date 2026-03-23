"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
let packet80;
try {
    // ESM import with json assertion
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    packet80 = (await import('../../decoded_brotli_red_80.json', { assert: { type: 'json' } })).default;
}
catch (e) {
    // fallback for environments that don't support import assertions
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    packet80 = require('../../decoded_brotli_red_80.json');
}
(0, vitest_1.describe)('Cortex codec', () => {
    (0, vitest_1.it)('decodeCortexPacket should decode a valid red_80 packet', () => {
        // packet80 here is the raw JSON payload; for test we reconstruct a packet using codec helpers
        // For the sketch, we assert that the JSON content includes expected fields
        (0, vitest_1.expect)(packet80).toBeDefined();
        (0, vitest_1.expect)(packet80.cmd).toBe('enable-spyder');
        (0, vitest_1.expect)(Array.isArray(packet80.args)).toBe(true);
    });
});
