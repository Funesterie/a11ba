"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVICE_MAP = void 0;
exports.resolvePaths = resolvePaths;
const fs_1 = require("fs");
const path_1 = require("path");
// Map service names to npm package names and local folder candidates
exports.SERVICE_MAP = {
    rome: { pkg: "@funeste38/rome", candidates: ["./rome", "./Rome"] },
    nezlephant: { pkg: "@funeste38/nezlephant", candidates: ["./nezlephant", "./Nezlephant"] },
    envaptex: { pkg: "@funeste38/envaptex", candidates: ["./envaptex", "./Envaptex"] },
    freeland: { pkg: "@funeste38/freeland", candidates: ["./freeland", "./Freeland"] },
    bat: { pkg: "@funeste38/bat", candidates: ["./bat", "./BAT"] },
};
function resolvePaths(detected = {}) {
    const out = {};
    for (const key of Object.keys(exports.SERVICE_MAP)) {
        if (detected && detected[key] && detected[key].path) {
            out[key] = detected[key].path;
            continue;
        }
        const tries = exports.SERVICE_MAP[key].candidates;
        for (const t of tries) {
            const p = (0, path_1.join)(process.cwd(), t);
            if ((0, fs_1.existsSync)(p)) {
                out[key] = p;
                break;
            }
        }
    }
    return out;
}
