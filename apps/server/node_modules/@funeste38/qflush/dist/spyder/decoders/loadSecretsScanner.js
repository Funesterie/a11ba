"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSecretScanner = loadSecretScanner;
const secrets_local_js_1 = require("./secrets-local.js");
async function loadSecretScanner() {
    // Prefer local scanner shipped in this repo. If an external spyder package is installed,
    // attempt to load it at runtime but don't keep a static reference that TypeScript must resolve.
    try {
        // dynamic require via eval to avoid TypeScript resolving this module name at compile time
        // eslint-disable-next-line no-eval
        const maybe = eval("typeof require !== 'undefined' ? require('@funeste38/spyder/decoders/secrets') : undefined");
        if (maybe && typeof maybe.scanFileForSecrets === 'function') {
            return { scanFileForSecrets: (filePath, options) => Promise.resolve(maybe.scanFileForSecrets(filePath, options)) };
        }
    }
    catch {
        // ignore any errors and fall back to local scanner
    }
    return secrets_local_js_1.localSecretScanner;
}
