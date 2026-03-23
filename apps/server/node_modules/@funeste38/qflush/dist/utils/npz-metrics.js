"use strict";
// ROME-TAG: 0x41A515
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsMiddleware = metricsMiddleware;
const prom_client_1 = __importDefault(require("prom-client"));
prom_client_1.default.collectDefaultMetrics();
function metricsMiddleware() {
    const registry = prom_client_1.default.register;
    return async function (req, res, next) {
        if (req.path === '/metrics') {
            res.set('Content-Type', registry.contentType);
            res.send(await registry.metrics());
            return;
        }
        next();
    };
}
exports.default = metricsMiddleware;
