"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dummyAction1 = dummyAction1;
exports.dummyAction2 = dummyAction2;
// @ts-ignore
const { vsOpenFile, vsBuildSolution, vsPing } = require("../../a11-vs-bridge.cjs");
const horn_1 = require("../core/horn");
(0, horn_1.registerHorn)("a11d.vs.ping", async () => {
    const res = await vsPing();
    return res;
});
(0, horn_1.registerHorn)("a11d.vs.openFile", async (payload) => {
    if (!payload?.path) {
        throw new Error("Missing path for a11d.vs.openFile");
    }
    const res = await vsOpenFile(payload.path, payload.line ?? 0, payload.column ?? 0);
    return res;
});
(0, horn_1.registerHorn)("a11d.vs.buildSolution", async () => {
    const res = await vsBuildSolution();
    return res;
});
// Node.js/TypeScript imports should use correct relative paths, e.g.:
// const { vsOpenFile, vsBuildSolution, vsPing } = require("../../a11-vs-bridge.cjs");
// Exemple de fonctions exportées pour le backend
async function dummyAction1() {
    return { ok: true, action: "dummyAction1" };
}
async function dummyAction2(param) {
    return { ok: true, action: "dummyAction2", param };
}
