"use strict";
// ROME-TAG: 0xFC1834
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
exports.parseLogicFile = parseLogicFile;
exports.evaluateConditionExprAST = evaluateConditionExprAST;
exports.buildConditionAst = buildConditionAst;
exports.evaluateConditionExpr = evaluateConditionExpr;
const fs = __importStar(require("fs"));
function parseLogicFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const rules = [];
    let i = 0;
    while (i < lines.length) {
        const l = lines[i];
        if (l.startsWith('rule ')) {
            const m = /^rule\s+(\w+)\s*\{/.exec(l);
            if (!m) {
                i++;
                continue;
            }
            const name = m[1];
            i++;
            let when = '';
            let action = '';
            let version = undefined;
            let priority = undefined;
            let schedule = undefined;
            while (i < lines.length && !lines[i].startsWith('}')) {
                const ln = lines[i];
                if (ln.startsWith('when '))
                    when = ln.slice('when '.length).trim();
                if (ln.startsWith('do '))
                    action = ln.slice('do '.length).trim();
                if (ln.startsWith('version ')) {
                    const v = Number(ln.slice('version '.length).trim());
                    if (!isNaN(v))
                        version = v;
                }
                if (ln.startsWith('priority ')) {
                    const p = Number(ln.slice('priority '.length).trim());
                    if (!isNaN(p))
                        priority = p;
                }
                if (ln.startsWith('schedule ')) {
                    schedule = ln.slice('schedule '.length).trim();
                }
                i++;
            }
            i++;
            rules.push({ name, when, do: action, version, priority, schedule });
        }
        else {
            i++;
        }
    }
    return rules;
}
// Very small expression parser for when expressions supporting variables and precedence
// grammar: expr := orExpr
// orExpr := andExpr ('or' andExpr)*
// andExpr := notExpr ('and' notExpr)*
// notExpr := 'not' notExpr | primary
// primary := '(' expr ')' | comparison
// comparison := identifier '==' string | identifier
function tokenize(s) {
    const tokens = [];
    const re = /\s*(=>|==|\(|\)|\band\b|\bor\b|\bnot\b|[\w.]+|"[^"]*")\s*/gi;
    let m;
    while ((m = re.exec(s)) !== null)
        tokens.push(m[1]);
    return tokens;
}
function parseExpr(tokens) {
    let i = 0;
    function peek() { return tokens[i]; }
    function consume() { return tokens[i++]; }
    function parsePrimary() {
        const t = peek();
        if (t === '(') {
            consume();
            const node = parseOr();
            if (peek() === ')')
                consume();
            return node;
        }
        const id = consume();
        if (peek() === '==') {
            consume();
            const val = consume();
            return { type: 'cmp', left: id, op: '==', right: val.replace(/^"|"$/g, '') };
        }
        return { type: 'id', name: id };
    }
    function parseNot() {
        if (peek() === 'not') {
            consume();
            return { type: 'not', expr: parseNot() };
        }
        return parsePrimary();
    }
    function parseAnd() {
        let left = parseNot();
        while (peek() === 'and') {
            consume();
            const right = parseNot();
            left = { type: 'and', left, right };
        }
        return left;
    }
    function parseOr() {
        let left = parseAnd();
        while (peek() === 'or') {
            consume();
            const right = parseAnd();
            left = { type: 'or', left, right };
        }
        return left;
    }
    const ast = parseOr();
    return ast;
}
function evaluateConditionExprAST(ast, ctx) {
    if (!ast)
        return false;
    switch (ast.type) {
        case 'cmp': {
            const left = ast.left;
            const right = ast.right;
            const val = resolveIdentifier(left, ctx);
            return String(val) === right;
        }
        case 'id': return !!resolveIdentifier(ast.name, ctx);
        case 'not': return !evaluateConditionExprAST(ast.expr, ctx);
        case 'and': return evaluateConditionExprAST(ast.left, ctx) && evaluateConditionExprAST(ast.right, ctx);
        case 'or': return evaluateConditionExprAST(ast.left, ctx) || evaluateConditionExprAST(ast.right, ctx);
        default: return false;
    }
}
function resolveIdentifier(id, ctx) {
    // support file.type, file.tagChanged, rome.index.updated
    if (id.startsWith('file.')) {
        const k = id.slice('file.'.length);
        return ctx.file ? ctx.file[k] : undefined;
    }
    if (id === 'rome.index.updated')
        return ctx.romeIndexUpdated;
    return undefined;
}
function buildConditionAst(expr) {
    const tokens = tokenize(expr);
    return parseExpr(tokens);
}
function evaluateConditionExpr(expr, ctx) {
    try {
        const ast = buildConditionAst(expr);
        return evaluateConditionExprAST(ast, ctx);
    }
    catch (e) {
        return false;
    }
}
