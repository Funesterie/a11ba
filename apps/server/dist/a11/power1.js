"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vsOpenFile = vsOpenFile;
exports.vsBuildSolution = vsBuildSolution;
exports.vsPing = vsPing;
async function vsOpenFile(path, line, column) {
    // Implémentation exemple (à remplacer par le vrai bridge VS)
    return { ok: true, action: "vsOpenFile", path, line, column };
}
async function vsBuildSolution() {
    // Implémentation exemple
    return { ok: true, action: "vsBuildSolution" };
}
async function vsPing() {
    // Implémentation exemple
    return { ok: true, action: "vsPing" };
}
