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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCompose = readCompose;
const fs = __importStar(require("fs"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const fclParser_js_1 = require("./fclParser.js");
function readCompose(file = 'funesterie.yml') {
    try {
        if (fs.existsSync('funesterie.fcl')) {
            const fcl = (0, fclParser_js_1.readFCL)('funesterie.fcl');
            if (fcl && fcl.service) {
                const modules = {};
                for (const k of Object.keys(fcl.service)) {
                    const s = fcl.service[k];
                    modules[k] = { path: s.path, port: s.port, token: s.token, env: s.env };
                }
                return { modules };
            }
        }
        if (!fs.existsSync(file))
            return null;
        const raw = fs.readFileSync(file, 'utf8');
        const doc = js_yaml_1.default.load(raw);
        if (!doc || !doc.modules)
            return null;
        return { modules: doc.modules };
    }
    catch (err) {
        return null;
    }
}
