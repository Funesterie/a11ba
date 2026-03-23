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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const routesConfig_js_1 = require("./routesConfig.js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
(0, vitest_1.describe)('routesConfig', () => {
    (0, vitest_1.it)('loads array routes', () => {
        const tmp = path.join(process.cwd(), '.qflush', 'cortex.routes.json');
        try {
            if (!fs.existsSync(path.dirname(tmp)))
                fs.mkdirSync(path.dirname(tmp), { recursive: true });
            fs.writeFileSync(tmp, JSON.stringify({ routes: ['A', 'B'] }, null, 2), 'utf8');
            const cfg = (0, routesConfig_js_1.loadRoutesConfig)();
            (0, vitest_1.expect)(cfg).toBeTruthy();
            const pick = (0, routesConfig_js_1.pickBestRoute)(['A', 'B']);
            (0, vitest_1.expect)(pick).toBe('A');
        }
        finally {
            try {
                fs.unlinkSync(tmp);
            }
            catch (e) { }
        }
    });
    (0, vitest_1.it)('respects disabled flag', () => {
        const tmp = path.join(process.cwd(), '.qflush', 'cortex.routes.json');
        try {
            fs.writeFileSync(tmp, JSON.stringify({ cortexActions: { 'A': true, 'B': false } }, null, 2), 'utf8');
            (0, vitest_1.expect)((0, routesConfig_js_1.isRouteEnabled)('A')).toBe(true);
            (0, vitest_1.expect)((0, routesConfig_js_1.isRouteEnabled)('B')).toBe(false);
        }
        finally {
            try {
                fs.unlinkSync(tmp);
            }
            catch (e) { }
        }
    });
});
