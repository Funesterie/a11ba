"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpProbe = httpProbe;
exports.tcpProbe = tcpProbe;
exports.waitForService = waitForService;
const http_1 = __importDefault(require("http"));
const net_1 = __importDefault(require("net"));
async function httpProbe(url, timeout = 2000) {
    return new Promise((resolve) => {
        const req = http_1.default.get(url, (res) => {
            res.resume();
            resolve(Boolean(res.statusCode && res.statusCode < 400));
        });
        req.on('error', () => resolve(false));
        req.setTimeout(timeout, () => {
            req.destroy();
            resolve(false);
        });
    });
}
async function tcpProbe(host, port, timeout = 2000) {
    return new Promise((resolve) => {
        const s = new net_1.default.Socket();
        let done = false;
        s.setTimeout(timeout);
        s.on('connect', () => {
            done = true;
            s.destroy();
            resolve(true);
        });
        s.on('error', () => { if (!done) {
            done = true;
            resolve(false);
        } });
        s.on('timeout', () => { if (!done) {
            done = true;
            s.destroy();
            resolve(false);
        } });
        s.connect(port, host);
    });
}
async function waitForService(urlOrHost, port, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        let ok = false;
        if (typeof port === 'number') {
            ok = await tcpProbe(urlOrHost, port, 1000);
        }
        else if (urlOrHost.startsWith('http')) {
            ok = await httpProbe(urlOrHost, 1000);
        }
        if (ok)
            return true;
        await new Promise((r) => setTimeout(r, 500));
    }
    return false;
}
