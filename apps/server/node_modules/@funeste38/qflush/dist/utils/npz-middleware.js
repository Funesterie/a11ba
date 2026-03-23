"use strict";
// ROME-TAG: 0x381550
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.npzMiddleware = npzMiddleware;
const uuid_1 = require("uuid");
const npz_router_js_1 = require("./npz-router.js");
const npz_store_js_1 = __importDefault(require("./npz-store.js"));
const logger_js_1 = require("./logger.js");
const prom_client_1 = __importDefault(require("prom-client"));
const npz_config_js_1 = require("./npz-config.js");
const NS = (0, npz_config_js_1.getNpzNamespace)();
const requestDuration = new prom_client_1.default.Histogram({
    name: `${NS}_request_duration_seconds`,
    help: 'Duration of NPZ handled requests',
    labelNames: ['gate', 'lane', 'npz_id', 'namespace'],
});
function npzMiddleware(opts = {}) {
    const cookieName = opts.cookieName || `${NS}_lane`;
    const lanes = opts.lanes || undefined;
    const maxAge = opts.cookieMaxAge || 24 * 3600; // seconds
    return async function (req, res, next) {
        const start = process.hrtime();
        try {
            // assign npz_id
            const npz_id = req.headers['x-npz-id'] || req.cookies?.['npz_id'] || (0, uuid_1.v4)();
            res.cookie('npz_id', npz_id, { maxAge: maxAge * 1000, httpOnly: true });
            await npz_store_js_1.default.createRequestRecord(npz_id, { path: req.path, method: req.method });
            const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
            const report = await (0, npz_router_js_1.npzRoute)({ method: req.method, url: fullUrl, headers: req.headers, body: req.body });
            if (report && (report.status || report.body || report.error)) {
                // update record with lane if stored via router
                const rec = await npz_store_js_1.default.getRequestRecord(npz_id);
                const lane = rec?.laneId;
                if (lane !== undefined) {
                    res.cookie(cookieName, String(lane), { maxAge: maxAge * 1000 });
                }
                // metrics
                const diff = process.hrtime(start);
                const duration = diff[0] + diff[1] / 1e9;
                const gate = report.gate || 'unknown';
                const laneId = report.laneId !== undefined ? String(report.laneId) : String(lane || 'unknown');
                requestDuration.labels(gate, laneId, npz_id, NS).observe(duration);
                logger_js_1.logger.info(`NPZ npz_id=${npz_id} gate=${gate} lane=${laneId} duration=${duration.toFixed(3)}s`);
                if (report.status)
                    res.status(report.status);
                // set headers (careful with set-cookie)
                if (report.headers) {
                    try {
                        for (const [k, v] of Object.entries(report.headers)) {
                            if (k.toLowerCase() === 'set-cookie')
                                continue;
                            res.setHeader(k, v);
                        }
                    }
                    catch (e) { }
                }
                res.send(report.body || (report.error ? String(report.error) : ''));
                return;
            }
            next();
        }
        catch (err) {
            logger_js_1.logger.warn(`npz-middleware: error ${err}`);
            next();
        }
    };
}
exports.default = npzMiddleware;
