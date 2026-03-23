#!/usr/bin/env node
"use strict";
// ROME-TAG: 0xE2F4A9
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = runEngine;
const index_loader_js_1 = require("../rome/index-loader.js");
const engine_js_1 = require("../rome/engine.js");
const executor_js_1 = require("../rome/executor.js");
async function runEngine(args) {
    const dry = args.includes('--dry-run') || args.includes('--dry');
    const idx = (0, index_loader_js_1.loadRomeIndexFromDisk)();
    const actions = (0, engine_js_1.evaluateIndex)(idx);
    console.log('Engine actions:', actions);
    if (dry) {
        console.log('Running in dry-run mode, simulating actions...');
        for (const a of actions) {
            try {
                // simulate by calling executeAction with dryRun
                const actionString = String(a.action ?? a);
                const res = await (0, executor_js_1.executeAction)(actionString, { path: a.path || null, dryRun: true });
                console.log('Simulate', a, '->', res);
            }
            catch (e) {
                console.warn('simulate failed', e);
            }
        }
    }
    return 0;
}
