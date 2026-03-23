"use strict";
// ROME-TAG: 0xF933B3
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNpzScores = runNpzScores;
const npz_engine_js_1 = __importDefault(require("../utils/npz-engine.js"));
const sync_1 = require("csv-stringify/sync");
async function runNpzScores(args = []) {
    const store = npz_engine_js_1.default.getStore();
    const items = Object.values(store).map((r) => ({ laneId: r.laneId, score: r.score, lastSuccess: r.lastSuccess, lastFailure: r.lastFailure }));
    // sort by score asc
    items.sort((a, b) => a.score - b.score);
    if (args.includes('--reset')) {
        npz_engine_js_1.default.resetScores();
        console.log('npz: scores reset');
        return 0;
    }
    if (args.includes('--csv')) {
        const records = items.map((it) => ({ laneId: it.laneId, score: it.score, lastSuccess: it.lastSuccess || '', lastFailure: it.lastFailure || '' }));
        const csv = (0, sync_1.stringify)(records, { header: true });
        console.log(csv);
        return 0;
    }
    console.log(JSON.stringify(items, null, 2));
    return 0;
}
exports.default = runNpzScores;
