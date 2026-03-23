"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lightRoute = lightRoute;
// src/spyder/lamp.ts
const horn_1 = require("../core/horn");
/**
 * Demande à la toile Spyder un chemin "éclairé" entre deux nœuds.
 * Ici on passe par un cri dans la corne → qui peut invoquer qflush spyder route.
 */
async function lightRoute(hint) {
    try {
        const res = await (0, horn_1.scream)('spyder.route', hint, {
            bin: 'qflush',
            args: ['spyder', 'route', hint.from, hint.to, String(hint.maxDepth ?? 8)],
        });
        const data = JSON.parse(res.out || '{}');
        return {
            ok: !!data.ok,
            steps: data.steps || [],
            reason: data.reason,
        };
    }
    catch (e) {
        return {
            ok: false,
            steps: [],
            reason: e?.message || String(e),
        };
    }
}
