"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSecretScanner = loadSecretScanner;
const scanner_js_1 = require("../core/scanner.js");
async function loadSecretScanner() {
    try {
        const external = await import('@funeste38/spyder/decoders/secrets');
        if (external && typeof external.scanFileForSecrets === 'function') {
            return { scanFileForSecrets: external.scanFileForSecrets };
        }
    }
    catch {
        // ignore
    }
    return scanner_js_1.localSecretScanner;
}
