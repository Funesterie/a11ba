"use strict";
// ROME-TAG: 0xD8C57D
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeEngineActions = void 0;
exports.evaluateIndex = evaluateIndex;
exports.computeEngineActionsSafe = computeEngineActionsSafe;
/**
 * Simple rule engine for Rome index v1.
 * Rules are evaluated in order and produce a list of actions.
 */
function evaluateIndex(index) {
    const actions = [];
    const records = Object.values(index || {});
    for (const r of records) {
        // Basic rules:
        // - any type === 'daemon' => start-service if matches known daemon files
        // - type === 'command' => watch + start-service 'cli'
        // - type === 'test' => noop (skip)
        // - type === 'asset' or ext === 'png'|'jpg' => encode-npz
        // - otherwise watch
        try {
            if (!r || !r.type || !r.path) {
                actions.push({ action: 'noop' });
                continue;
            }
            const t = r.type;
            const ext = r.ext ? r.ext.toLowerCase() : '';
            if (t === 'daemon') {
                actions.push({ action: 'start-service', service: 'qflush-daemon', path: r.path });
                continue;
            }
            if (t === 'command') {
                actions.push({ action: 'watch', path: r.path, reason: 'cli-command' });
                actions.push({ action: 'start-service', service: 'cli-dispatcher', path: r.path });
                continue;
            }
            if (t === 'test') {
                actions.push({ action: 'noop', path: r.path });
                continue;
            }
            if (t === 'asset' || ['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) {
                actions.push({ action: 'encode-npz', path: r.path, codec: 'oc8-rgba' });
                continue;
            }
            // default: watch files for changes
            actions.push({ action: 'watch', path: r.path });
        }
        catch (e) {
            actions.push({ action: 'noop', path: r.path });
        }
    }
    return actions;
}
// Safe wrapper used by daemon to compute actions without throwing
function computeEngineActionsSafe(index) {
    try {
        const idx = index || {};
        return evaluateIndex(idx);
    }
    catch (e) {
        // don't throw in daemon context; return empty actions and let caller log
        try {
            console.warn('computeEngineActionsSafe failed', String(e));
        }
        catch (err) {
            console.warn('computeEngineActionsSafe failed to log:', err);
        }
        return [];
    }
}
// Backwards-compatible alias: some callers use `computeEngineActions`
exports.computeEngineActions = computeEngineActionsSafe;
