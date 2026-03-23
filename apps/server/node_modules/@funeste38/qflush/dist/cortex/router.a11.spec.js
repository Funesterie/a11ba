"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const router_js_1 = require("./router.js");
(0, vitest_1.describe)('cortex:a11-suggest handler', () => {
    (0, vitest_1.it)('returns suggestion from services.a11', async () => {
        const packet = { type: 'cortex:a11-suggest', payload: { prompt: 'Suggest 1 step' } };
        const services = {
            a11: {
                ask: async (prompt) => ({ choices: [{ message: { content: 'Step 1: do something' } }] })
            }
        };
        const res = await (0, router_js_1.routeCortexPacket)(packet, services);
        (0, vitest_1.expect)(res).toBeDefined();
        (0, vitest_1.expect)(res.ok).toBe(true);
        (0, vitest_1.expect)(res.suggestion).toBeDefined();
        // suggestion is the raw response from a11.ask
        (0, vitest_1.expect)(res.suggestion.choices[0].message.content).toContain('Step 1');
    });
    (0, vitest_1.it)('returns error when service missing', async () => {
        const packet = { type: 'cortex:a11-suggest', payload: { prompt: 'Suggest' } };
        const res = await (0, router_js_1.routeCortexPacket)(packet, undefined);
        (0, vitest_1.expect)(res).toBeDefined();
        (0, vitest_1.expect)(res.ok).toBe(false);
        (0, vitest_1.expect)(res.error).toBe('a11_service_missing');
    });
});
