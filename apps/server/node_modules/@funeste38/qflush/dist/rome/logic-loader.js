"use strict";
// ROME-TAG: 0xD4EB1C
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
exports.loadLogicRules = loadLogicRules;
exports.evaluateRulesForRecord = evaluateRulesForRecord;
exports.evaluateAllRules = evaluateAllRules;
exports.getRules = getRules;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logic_parser_js_1 = require("./logic-parser.js");
const LOGIC_PATH = path.join(process.cwd(), '.qflush', 'logic.qfl');
const VARS_PATH = path.join(process.cwd(), '.qflush', 'logic-vars.json');
let rules = [];
let vars = {};
function loadVars() {
    try {
        if (fs.existsSync(VARS_PATH)) {
            vars = JSON.parse(fs.readFileSync(VARS_PATH, 'utf8') || '{}');
        }
    }
    catch (e) {
        vars = {};
    }
}
function substitute(s) {
    if (!s)
        return s;
    // ${VAR} substitution from vars then from process.env
    return s.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, name) => {
        if (vars && typeof vars[name] !== 'undefined')
            return vars[name];
        if (process.env[name])
            return process.env[name];
        return '';
    });
}
function loadLogicRules() {
    // prefer .qflush/logic.qfl then src/rome/logic/logic.qfl
    const alt = path.join(process.cwd(), 'src', 'rome', 'logic', 'logic.qfl');
    const p = fs.existsSync(LOGIC_PATH) ? LOGIC_PATH : alt;
    if (!fs.existsSync(p)) {
        rules = [];
        return rules;
    }
    try {
        loadVars();
        const parsed = (0, logic_parser_js_1.parseLogicFile)(p);
        // apply substitutions and keep schedule/version/priority
        rules = parsed.map(r => ({ ...r, when: substitute(r.when), do: substitute(r.do) }));
    }
    catch (e) {
        rules = [];
    }
    return rules;
}
function evaluateRulesForRecord(index, rec, changedPaths = []) {
    const matched = [];
    for (const r of rules) {
        const cond = r.when || '';
        try {
            const ast = (0, logic_parser_js_1.buildConditionAst)(cond);
            const ctx = { file: rec, romeIndexUpdated: (changedPaths && changedPaths.length > 0) };
            const ok = (0, logic_parser_js_1.evaluateConditionExprAST)(ast, ctx);
            if (ok)
                matched.push({ rule: r.name, actions: [r.do] });
        }
        catch (e) {
            // ignore parse/eval errors per-rule
        }
    }
    return matched;
}
function evaluateAllRules(index, changedPaths = []) {
    const actions = [];
    for (const rec of Object.values(index)) {
        const a = evaluateRulesForRecord(index, rec, changedPaths);
        for (const m of a)
            actions.push({ path: rec.path, actions: m.actions, rule: m.rule });
    }
    // future: sort by priority/version
    return actions;
}
function getRules() { return rules; }
