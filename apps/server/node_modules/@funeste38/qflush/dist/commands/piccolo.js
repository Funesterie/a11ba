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
exports.runPiccolo = runPiccolo;
const logger_js_1 = require("../utils/logger.js");
const doctor_js_1 = require("./doctor.js");
const repairs_imports_js_1 = require("../piccolo/repairs-imports.js");
const repairs_tsconfig_js_1 = require("../piccolo/repairs-tsconfig.js");
const repairs_ci_js_1 = require("../piccolo/repairs-ci.js");
const tests_safe_js_1 = require("../piccolo/tests-safe.js");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
async function runPiccolo(argv = []) {
    logger_js_1.logger.info("PICCOLO: self-regen starting...");
    // 1) snapshot de l’état
    const snapshot = {
        date: new Date().toISOString(),
        cwd: process.cwd(),
        services: [],
        ports: [],
        env: process.env,
    };
    fs.writeFileSync(path.join(process.cwd(), ".qflush", "piccolo-snapshot.json"), JSON.stringify(snapshot, null, 2), "utf8");
    // 2) doctor + auto-fix
    await (0, doctor_js_1.runDoctor)(["--piccolo"]);
    // 3) réparations ciblées
    await (0, repairs_imports_js_1.repairImportsAndDeps)();
    await (0, repairs_tsconfig_js_1.repairTsConfig)();
    await (0, repairs_ci_js_1.repairWorkflows)();
    // 4) tests en mode “safe”
    const ok = await (0, tests_safe_js_1.runTestsSafe)();
    logger_js_1.logger.info(`PICCOLO: regen ${ok ? "OK" : "incomplete (tests red)"}`);
    logger_js_1.logger.info("PICCOLO: self-regen terminé (squelette, à compléter)");
}
