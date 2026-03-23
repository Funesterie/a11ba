"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPipeline = buildPipeline;
exports.executePipeline = executePipeline;
const logger_1 = require("../utils/logger");
const detect_1 = require("../commands/detect");
const config_1 = require("../commands/config");
const purge_1 = require("../commands/purge");
const kill_1 = require("../commands/kill");
const start_1 = require("../commands/start");
const exodia_1 = require("../commands/exodia");
const ORDER = ["detect", "config", "purge", "kill", "start", "exodia"];
function parseArgs(argv) {
    const cmds = [];
    const flags = {};
    const modulePaths = {};
    const tokens = {};
    const services = [];
    let currentService;
    let i = 0;
    while (i < argv.length) {
        const a = argv[i];
        if (!a.startsWith("-")) {
            cmds.push(a.toLowerCase());
            i++;
            continue;
        }
        const clean = a.replace(/^--?/, "");
        if (clean === "service" || clean === "s") {
            const next = argv[i + 1];
            if (next && !next.startsWith("-")) {
                currentService = next.toLowerCase();
                services.push(currentService);
                i += 2;
                continue;
            }
            else {
                i++;
                continue;
            }
        }
        if (clean === "path") {
            const next = argv[i + 1];
            if (next && !next.startsWith("-")) {
                if (currentService)
                    modulePaths[currentService] = next;
                i += 2;
                continue;
            }
            i++;
            continue;
        }
        if (clean === "token") {
            const next = argv[i + 1];
            if (next && !next.startsWith("-")) {
                if (currentService)
                    tokens[currentService] = next;
                i += 2;
                continue;
            }
            i++;
            continue;
        }
        const kv = clean.split("=");
        if (kv.length === 2) {
            flags[kv[0]] = kv[1];
            i++;
            continue;
        }
        const next = argv[i + 1];
        if (next && !next.startsWith("-")) {
            flags[clean] = next;
            i += 2;
            continue;
        }
        flags[clean] = true;
        i++;
    }
    return { cmds, flags, modulePaths, tokens, services };
}
function buildPipeline(argv) {
    const { cmds, flags, modulePaths, tokens, services } = parseArgs(argv);
    const unique = Array.from(new Set(cmds));
    const known = unique.filter((c) => ORDER.includes(c));
    // 🚨 Ajout spécial pour horn : pipeline vide
    if (unique.includes('horn')) {
        return {
            pipeline: [],
            options: { flags, modulePaths, tokens, global: {}, services },
        };
    }
    if (known.length === 0)
        return {
            pipeline: ["detect", "config", "start"],
            options: { flags, modulePaths, tokens, global: {}, services },
        };
    // build set with dependencies
    const set = new Set(known);
    // dependencies mapping
    const deps = {
        start: ["config"],
        config: ["detect"],
        purge: ["detect"],
    };
    // add dependencies recursively
    function addDeps(cmd) {
        const ds = deps[cmd] || [];
        for (const d of ds) {
            if (!set.has(d)) {
                set.add(d);
                addDeps(d);
            }
        }
    }
    for (const k of Array.from(set))
        addDeps(k);
    let final = [];
    // Flag-driven transformations
    if (flags["fresh"]) {
        set.add("purge");
        // ensure purge runs before start
    }
    if (flags["force"]) {
        // make sure kill runs before start
        set.add("kill");
    }
    const requestedKill = known.includes("kill");
    if (requestedKill) {
        // put kill first if user explicitly requested it
        final.push("kill");
        for (const k of ORDER) {
            if (k === "kill")
                continue;
            if (set.has(k))
                final.push(k);
        }
    }
    else {
        for (const k of ORDER) {
            if (set.has(k))
                final.push(k);
        }
    }
    // remove duplicates and preserve order
    final = final.filter((v, i) => final.indexOf(v) === i);
    logger_1.logger.info(`SmartChain built pipeline: ${final.join(" -> ")}`);
    const options = { global: {}, flags, modulePaths, tokens, services };
    return { pipeline: final, options };
}
async function executePipeline(pipeline, options) {
    for (const step of pipeline) {
        logger_1.logger.info(`Executing pipeline step: ${step}`);
        switch (step) {
            case "detect": {
                const detected = await (0, detect_1.runDetect)(options);
                options.detected = detected || {};
                if (detected && typeof detected === "object") {
                    options.modulePaths = { ...(options.modulePaths || {}), ...(detected.paths || {}) };
                }
                break;
            }
            case "config":
                await (0, config_1.runConfig)(options);
                break;
            case "purge":
                await (0, purge_1.runPurge)(options);
                break;
            case "kill":
                await (0, kill_1.runKill)(options);
                break;
            case "start":
                await (0, start_1.runStart)(options);
                break;
            case "exodia":
                await (0, exodia_1.runExodia)(options);
                break;
            default:
                logger_1.logger.warn(`Unknown pipeline step: ${step}`);
        }
    }
}
