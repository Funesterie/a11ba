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
exports.importUtil = importUtil;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// avoid static import of './paths' to prevent TypeScript module resolution issues in some environments
let resolvePaths = undefined;
try {
    // require at runtime; if not available, leave undefined
    // use dynamic path to avoid TypeScript module resolution of literal './paths'
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const p = require(path.join(__dirname, 'paths'));
    resolvePaths = p && p.resolvePaths;
}
catch (e) {
    resolvePaths = undefined;
}
const isTest = process.env.NODE_ENV === 'test';
function warn(...args) { if (!isTest)
    console.warn(...args); }
function tryRequire(filePath) {
    try {
        if (fs.existsSync(filePath))
            return require(filePath);
    }
    catch (e) {
        try {
            return require(filePath);
        }
        catch (e) {
            warn('[alias] tryRequire fallback require failed', String(e));
        }
    }
    return undefined;
}
function tryRequireVariants(basePath) {
    // Only try .js and /index.js, never .ts in runtime
    const variants = [".js", "/index.js"];
    for (const v of variants) {
        const p = basePath.endsWith(v) ? basePath : basePath + v;
        const m = tryRequire(p);
        if (m)
            return (m && m.default) || m;
    }
    return undefined;
}
function importUtil(name) {
    // normalize alias forms such as '@utils/foo' or '#utils/foo' to a simple local name
    let localName = name;
    const aliasMatch = name && (name.startsWith('@utils/') || name.startsWith('#utils/'));
    if (aliasMatch)
        localName = name.replace(/^(@|#)?utils\//, '');
    // prefer spyder local workspace copy when present
    try {
        if (typeof resolvePaths === 'function') {
            const paths = resolvePaths();
            const spy = paths && paths['spyder'];
            if (spy) {
                // common locations inside spyder package layout
                const candidates = [
                    path.join(spy, 'apps', 'spyder-core', 'src', 'utils', localName),
                    path.join(spy, 'apps', 'spyder-core', 'src', localName),
                    path.join(spy, 'src', 'utils', localName),
                    path.join(spy, 'src', localName),
                    path.join(spy, 'utils', localName),
                ];
                for (const c of candidates) {
                    const m = tryRequireVariants(c);
                    if (m)
                        return m;
                }
                // try requiring from spyder root via Node resolution (works if spyder is a package)
                try {
                    const resolved = require.resolve(localName, { paths: [spy] });
                    const m = require(resolved);
                    if (m)
                        return (m && m.default) || m;
                }
                catch (e) {
                    warn('[alias] require.resolve from spyder failed', String(e));
                }
            }
        }
    }
    catch (e) {
        warn('[alias] resolvePaths check failed', String(e));
    }
    // If name was an alias like @utils/foo, try local src/utils/<foo>
    if (aliasMatch) {
        try {
            const local = tryRequireVariants(path.join(__dirname, localName));
            if (local)
                return local;
        }
        catch (e) {
            console.warn('[alias] tryRequireVariants local failed', String(e));
        }
    }
    // fallback: if a relative path or module name was passed, try requiring directly
    try {
        // try direct file/module
        const m1 = tryRequire(name);
        if (m1)
            return (m1 && m1.default) || m1;
    }
    catch (e) {
        console.warn('[alias] tryRequire direct failed', String(e));
    }
    return undefined;
}
