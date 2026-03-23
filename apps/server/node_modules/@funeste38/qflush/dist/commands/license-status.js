"use strict";
// ROME-TAG: 0x9398B5
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = runLicenseStatus;
const license_js_1 = __importDefault(require("../utils/license.js"));
async function runLicenseStatus() {
    const lic = license_js_1.default.readLicense();
    if (!lic) {
        console.log('No license found');
        return 0;
    }
    console.log(JSON.stringify(lic, null, 2));
    return 0;
}
