"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLicense = runLicense;
/* ROME-TAG: 0xF45330 */
const alias = __importStar(require("../utils/alias.js"));
const logger = alias.importUtil('@utils/logger') || alias.importUtil('../utils/logger') || console;
const gumroad_license_js_1 = __importDefault(require("../utils/gumroad-license.js"));
const secrets_js_1 = require("../utils/secrets.js");
const gandalf_light_1 = require("../core/gandalf-light");
async function runLicense(argv = []) {
    (0, gandalf_light_1.whiteLight)('daemon.start', { phase: 'license-init', argv });
    const sub = argv[0];
    if (!sub) {
        logger.info('Usage: qflush license activate <key> [--product=<id>]');
        return 1;
    }
    if (sub === 'activate') {
        const key = argv[1];
        if (!key) {
            logger.error('No license key provided. Usage: qflush license activate <key> [--product=<id>]');
            return 1;
        }
        // parse optional --product=ID
        const prodArg = argv.find((a) => a.startsWith('--product='));
        const productId = prodArg ? prodArg.split('=')[1] : process.env.GUMROAD_PRODUCT_ID || process.env.GUMROAD_PRODUCT_YEARLY || process.env.GUMROAD_PRODUCT_MONTHLY;
        const token = (0, secrets_js_1.getSecret)('GUMROAD_TOKEN', { fileEnv: 'GUMROAD_TOKEN_FILE' });
        if (!token) {
            logger.error('GUMROAD_TOKEN not set (env or file). Set it to perform activation.');
            return 1;
        }
        if (!productId) {
            logger.warn('No product id provided, continuing with provided key verification (Gumroad may accept product lookup).');
        }
        try {
            const rec = await gumroad_license_js_1.default.activateLicense(productId, key, token);
            logger.success(`License activated. Expires: ${rec.expiresAt ? new Date(rec.expiresAt).toISOString() : 'subscription/never'}`);
            return 0;
        }
        catch (err) {
            logger.error(`License activation failed: ${err.message || err}`);
            return 2;
        }
    }
    if (sub === 'status') {
        const rec = gumroad_license_js_1.default.loadLicense();
        if (!rec) {
            logger.info('No local license found');
            return 0;
        }
        logger.info(`Local license: key=${rec.key} product=${rec.product_id} expires=${rec.expiresAt ? new Date(rec.expiresAt).toISOString() : 'never'}`);
        return 0;
    }
    if (sub === 'clear') {
        gumroad_license_js_1.default.clearLicense();
        logger.info('Local license cleared');
        return 0;
    }
    logger.info('Unknown license command');
    return 1;
}
