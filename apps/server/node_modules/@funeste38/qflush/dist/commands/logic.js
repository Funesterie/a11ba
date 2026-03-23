#!/usr/bin/env node
"use strict";
// ROME-TAG: 0x66F831
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = runLogic;
const logic_loader_js_1 = require("../rome/logic-loader.js");
const index_loader_js_1 = require("../rome/index-loader.js");
const logic_loader_js_2 = require("../rome/logic-loader.js");
async function runLogic(args) {
    const rules = (0, logic_loader_js_1.loadLogicRules)();
    console.log('Loaded rules:', rules.map(r => r.name));
    const idx = (0, index_loader_js_1.loadRomeIndexFromDisk)();
    for (const p of Object.values(idx)) {
        const matches = (0, logic_loader_js_2.evaluateRulesForRecord)(idx, p);
        if (matches.length)
            console.log('Match for', p.path, matches);
    }
    return 0;
}
