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
exports.cleanupDatedArchives = cleanupDatedArchives;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Remove dated subfolders named YYYY-MM older than keepMonths
function cleanupDatedArchives(baseDir, keepMonths = 6) {
    try {
        if (!fs.existsSync(baseDir))
            return;
        const entries = fs.readdirSync(baseDir, { withFileTypes: true });
        const now = new Date();
        for (const e of entries) {
            if (!e.isDirectory())
                continue;
            const name = e.name;
            const m = /^([0-9]{4})-([0-9]{2})$/.exec(name);
            if (!m)
                continue;
            const year = Number(m[1]);
            const month = Number(m[2]);
            if (!year || !month)
                continue;
            const dirDate = new Date(year, month - 1, 1);
            const monthsDiff = (now.getFullYear() - dirDate.getFullYear()) * 12 + (now.getMonth() - dirDate.getMonth());
            if (monthsDiff > keepMonths) {
                // remove directory recursively
                try {
                    fs.rmSync(path.join(baseDir, name), { recursive: true, force: true });
                }
                catch (e) {
                    try {
                        // fallback for older Node: use custom rm
                        const rimraf = (p) => {
                            if (!fs.existsSync(p))
                                return;
                            for (const f of fs.readdirSync(p)) {
                                const fp = path.join(p, f);
                                const st = fs.statSync(fp);
                                if (st.isDirectory())
                                    rimraf(fp);
                                else
                                    fs.unlinkSync(fp);
                            }
                            fs.rmdirSync(p);
                        };
                        rimraf(path.join(baseDir, name));
                    }
                    catch (e2) { }
                }
            }
        }
    }
    catch (e) {
        // ignore errors
    }
}
exports.default = { cleanupDatedArchives };
