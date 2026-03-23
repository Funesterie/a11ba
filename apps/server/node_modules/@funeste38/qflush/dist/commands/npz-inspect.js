"use strict";
// ROME-TAG: 0x025858
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNpzInspect = runNpzInspect;
const npz_store_js_1 = __importDefault(require("../utils/npz-store.js"));
async function runNpzInspect(id) {
    const rec = await npz_store_js_1.default.getRequestRecord(id);
    if (!rec) {
        console.log(`npz: record ${id} not found`);
        return 1;
    }
    console.log(JSON.stringify(rec, null, 2));
    return 0;
}
exports.default = runNpzInspect;
