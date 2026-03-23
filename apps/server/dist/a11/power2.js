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
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.runShell = runShell;
const horn_1 = require("../core/horn");
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
/**
 * Lire un fichier texte UTF-8
 */
(0, horn_1.registerHorn)("a11d.fs.read", async (payload) => {
    const p = path.resolve(process.cwd(), payload.file);
    const content = await fs.readFile(p, "utf8");
    return { ok: true, file: p, content };
});
/**
 * Écrire un fichier texte UTF-8
 */
(0, horn_1.registerHorn)("a11d.fs.write", async (payload) => {
    const p = path.resolve(process.cwd(), payload.file);
    await fs.writeFile(p, payload.content ?? "", "utf8");
    return { ok: true, file: p };
});
/**
 * Lancer une commande shell (git, npm, dotnet, qflush, etc.)
 */
(0, horn_1.registerHorn)("a11d.shell.run", async (payload) => {
    const cmd = payload.cmd;
    const args = payload.args || [];
    const cwd = payload.cwd || process.cwd();
    return await new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)(cmd, args, {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
            shell: false,
        });
        let out = "";
        let err = "";
        child.stdout.on("data", d => (out += d.toString()));
        child.stderr.on("data", d => (err += d.toString()));
        child.on("close", code => {
            resolve({ ok: code === 0, code, out, err });
        });
        child.on("error", e => reject(e));
    });
});
/**
 * Raccourcis haut niveau
 */
(0, horn_1.registerHorn)("a11d.git.status", async () => {
    return await (0, horn_1.scream)("a11d.shell.run", {
        cmd: "git",
        args: ["status", "--short"],
    });
});
(0, horn_1.registerHorn)("a11d.tests.run", async () => {
    return await (0, horn_1.scream)("a11d.shell.run", {
        cmd: "npm",
        args: ["test"],
    });
});
(0, horn_1.registerHorn)("a11d.build.run", async () => {
    return await (0, horn_1.scream)("a11d.shell.run", {
        cmd: "npm",
        args: ["run", "build"],
    });
});
/**
 * Intégration runner.exe (si tu veux qu’il contrôle l’OS)
 */
(0, horn_1.registerHorn)("a11d.ui.sendKeys", async (payload) => {
    return await (0, horn_1.scream)("a11d.shell.run", {
        cmd: "a11-runner.exe",
        args: ["send-keys", payload.text],
    });
});
(0, horn_1.registerHorn)("a11d.ui.click", async (payload) => {
    const args = ["click"];
    if (payload.x != null && payload.y != null) {
        args.push(String(payload.x), String(payload.y));
    }
    if (payload.button)
        args.push("--button", payload.button);
    return await (0, horn_1.scream)("a11d.shell.run", {
        cmd: "a11-runner.exe",
        args,
    });
});
(0, horn_1.registerHorn)("a11d.tunnel.status", async () => {
    return await (0, horn_1.scream)("a11d.shell.run", {
        cmd: "cloudflared.exe",
        args: ["tunnel", "list"],
    });
});
(0, horn_1.registerHorn)("a11d.netlify.deploy", async () => {
    return await (0, horn_1.scream)("a11d.shell.run", {
        cmd: "netlify",
        args: ["deploy", "--dir", "apps/web/dist", "--prod"],
    });
});
// Exemple de fonction exportée pour le backend
async function readFile(file) {
    const p = path.resolve(process.cwd(), file);
    const content = await fs.readFile(p, "utf8");
    return { ok: true, file: p, content };
}
async function writeFile(file, content) {
    const p = path.resolve(process.cwd(), file);
    await fs.writeFile(p, content ?? "", "utf8");
    return { ok: true, file: p };
}
async function runShell(cmd, args, cwd) {
    cwd = cwd || process.cwd();
    return await new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)(cmd, args || [], {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
            shell: false,
        });
        let out = "";
        let err = "";
        child.stdout.on("data", d => (out += d.toString()));
        child.stderr.on("data", d => (err += d.toString()));
        child.on("close", code => {
            resolve({ ok: code === 0, code, out, err });
        });
        child.on("error", e => reject(e));
    });
}
