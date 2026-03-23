"use strict";
// ROME-TAG: 0x1D49C5
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScores = getScores;
exports.resetScores = resetScores;
exports.getOrderedLanes = getOrderedLanes;
const npz_engine_js_1 = __importDefault(require("../../utils/npz-engine.js"));
function getScores() {
    const store = npz_engine_js_1.default.getStore();
    return Object.values(store).map((r) => ({ laneId: r.laneId, score: r.score, lastSuccess: r.lastSuccess, lastFailure: r.lastFailure }));
}
function resetScores() {
    npz_engine_js_1.default.resetScores();
}
function getOrderedLanes(lanes) {
    return npz_engine_js_1.default.orderLanesByScore(lanes);
}
exports.default = { getScores, resetScores, getOrderedLanes };
