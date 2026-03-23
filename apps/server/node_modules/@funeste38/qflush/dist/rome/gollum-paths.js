"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRomeIndex = loadRomeIndex;
exports.resolveGollumPath = resolveGollumPath;
// src/rome/gollum-paths.ts
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
let cache = null;
let cacheRoot = null;
/**
 * Charge l’index Rome (aliases / services).
 */
function loadRomeIndex(opts = {}) {
    const root = opts.root || process.cwd();
    if (cache && cacheRoot === root)
        return cache;
    const indexPath = node_path_1.default.join(root, opts.indexFile || '.qflush/rome.index.json');
    if (!node_fs_1.default.existsSync(indexPath)) {
        cache = { aliases: {}, services: {} };
        cacheRoot = root;
        return cache;
    }
    const raw = node_fs_1.default.readFileSync(indexPath, 'utf8');
    cache = JSON.parse(raw);
    cacheRoot = root;
    return cache;
}
/**
 * Gollum qui chuchote le bon chemin.
 * - cherche dans aliases
 * - cherche dans services
 * - sinon tente un chemin brut relatif au root
 */
function resolveGollumPath(name, opts = {}) {
    const root = opts.root || process.cwd();
    const index = loadRomeIndex(opts);
    if (index.aliases?.[name]) {
        return node_path_1.default.resolve(root, index.aliases[name]);
    }
    if (index.services?.[name]?.path) {
        return node_path_1.default.resolve(root, index.services[name].path);
    }
    const candidate = node_path_1.default.resolve(root, name);
    if (node_fs_1.default.existsSync(candidate))
        return candidate;
    return null;
}
