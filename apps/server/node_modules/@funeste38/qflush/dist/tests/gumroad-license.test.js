"use strict";
// ROME-TAG: 0x70150D
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const gumroad_license_js_1 = require("../utils/gumroad-license.js");
(0, vitest_1.describe)('gumroad-license save/load/clear', () => {
    (0, vitest_1.beforeAll)(() => {
        (0, gumroad_license_js_1.clearLicense)();
    });
    (0, vitest_1.afterAll)(() => {
        (0, gumroad_license_js_1.clearLicense)();
    });
    (0, vitest_1.test)('save and load', () => {
        (0, gumroad_license_js_1.saveLicense)({ key: 'ABC', product_id: 'p1', createdAt: Date.now() });
        const loaded = (0, gumroad_license_js_1.loadLicense)();
        (0, vitest_1.expect)(loaded).not.toBeNull();
        (0, vitest_1.expect)(loaded.key).toBe('ABC');
    });
    (0, vitest_1.test)('clear', () => {
        (0, gumroad_license_js_1.clearLicense)();
        const loaded = (0, gumroad_license_js_1.loadLicense)();
        (0, vitest_1.expect)(loaded).toBeNull();
    });
});
