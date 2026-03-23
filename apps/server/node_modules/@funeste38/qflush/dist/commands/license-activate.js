"use strict";
// ROME-TAG: 0xA65E04
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = runLicenseActivate;
const license_js_1 = __importDefault(require("../utils/license.js"));
async function runLicenseActivate(args) {
    const key = args[0];
    const product = args[1] || process.env.GUMROAD_PRODUCT_MONTHLY;
    if (!key) {
        console.error('usage: qflush license:activate <key> [product_id]');
        return 1;
    }
    try {
        const res = await license_js_1.default.activateLicense(key, product);
        if (res.ok) {
            console.log('License activated:', res.license);
            return 0;
        }
        console.error('Activation failed:', res.error);
        return 2;
    }
    catch (e) {
        console.error('Activation error:', e);
        return 3;
    }
}
