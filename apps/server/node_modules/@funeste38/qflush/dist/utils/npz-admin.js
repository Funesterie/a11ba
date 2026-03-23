"use strict";
// ROME-TAG: 0x332555
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const npz_store_js_1 = __importDefault(require("./npz-store.js"));
const npz_router_js_1 = __importDefault(require("./npz-router.js"));
const npz_engine_js_1 = __importDefault(require("./npz-engine.js"));
const sync_1 = require("csv-stringify/sync");
const auth_js_1 = require("./auth.js");
const router = express_1.default.Router();
function requireToken(req, res, next) {
    if (!(0, auth_js_1.isAdminAuthorized)(req))
        return res.status(401).json({ error: 'unauthorized' });
    next();
}
router.use('/npz', requireToken);
router.get('/npz/inspect/:id', async (req, res) => {
    const r = await npz_store_js_1.default.getRequestRecord(req.params.id);
    res.json(r || { error: 'not found' });
});
router.get('/npz/lanes', (req, res) => {
    res.json(npz_router_js_1.default.DEFAULT_LANES);
});
router.get('/npz/preferred/:host', (req, res) => {
    const host = req.params.host;
    const pref = npz_router_js_1.default.getPreferredLane(host);
    res.json({ host, preferred: pref });
});
router.get('/npz/circuit/:host', (req, res) => {
    const host = req.params.host;
    const state = npz_router_js_1.default.getCircuitState(host);
    res.json(state);
});
// Admin scores endpoint
router.get('/npz/scores', (req, res) => {
    try {
        const store = npz_engine_js_1.default.getStore();
        const items = Object.values(store).map((r) => ({ laneId: r.laneId, score: r.score, lastSuccess: r.lastSuccess, lastFailure: r.lastFailure }));
        items.sort((a, b) => a.score - b.score);
        res.json(items);
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
router.post('/npz/scores/reset', (req, res) => {
    try {
        npz_engine_js_1.default.resetScores();
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
router.get('/npz/scores.csv', (req, res) => {
    try {
        const store = npz_engine_js_1.default.getStore();
        const items = Object.values(store).map((r) => ({ laneId: r.laneId, score: r.score, lastSuccess: r.lastSuccess, lastFailure: r.lastFailure }));
        items.sort((a, b) => a.score - b.score);
        const csv = (0, sync_1.stringify)(items, { header: true });
        res.set('Content-Type', 'text/csv');
        res.send(csv);
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
exports.default = router;
