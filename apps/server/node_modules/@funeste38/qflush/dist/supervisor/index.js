"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRunning = listRunning;
exports.startProcess = startProcess;
exports.stopProcess = stopProcess;
exports.stopAll = stopAll;
exports.clearState = clearState;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const logger_js_1 = require("../utils/logger.js");
const STATE_DIR = (0, path_1.join)(process.cwd(), '.qflash');
const LOGS_DIR = (0, path_1.join)(STATE_DIR, 'logs');
const STATE_FILE = (0, path_1.join)(STATE_DIR, 'services.json');
let procs = {};
function ensureStateDir() {
    if (!(0, fs_1.existsSync)(STATE_DIR))
        (0, fs_1.mkdirSync)(STATE_DIR, { recursive: true });
    if (!(0, fs_1.existsSync)(LOGS_DIR))
        (0, fs_1.mkdirSync)(LOGS_DIR, { recursive: true });
}
function persist() {
    try {
        ensureStateDir();
        (0, fs_1.writeFileSync)(STATE_FILE, JSON.stringify(procs, null, 2), 'utf8');
    }
    catch (err) {
        logger_js_1.logger.warn(`Failed to persist supervisor state: ${err}`);
    }
}
function load() {
    try {
        if ((0, fs_1.existsSync)(STATE_FILE)) {
            const raw = (0, fs_1.readFileSync)(STATE_FILE, 'utf8');
            procs = JSON.parse(raw);
        }
    }
    catch (err) {
        logger_js_1.logger.warn(`Failed to load supervisor state: ${err}`);
    }
}
load();
function listRunning() {
    return Object.values(procs);
}
function startProcess(name, cmd, args = [], opts = {}) {
    ensureStateDir();
    logger_js_1.logger.info(`supervisor: starting ${name} -> ${cmd} ${args.join(' ')}`);
    const logFile = opts.logPath || (0, path_1.join)(LOGS_DIR, `${name}.log`);
    const outStream = (0, fs_1.createWriteStream)(logFile, { flags: 'a' });
    const spawnOpts = { cwd: opts.cwd || process.cwd(), shell: true };
    // decide stdio based on detached/background
    if (opts.detached) {
        spawnOpts.detached = true;
        // ignore stdin, pipe stdout/stderr to log
        spawnOpts.stdio = ['ignore', 'pipe', 'pipe'];
    }
    else {
        spawnOpts.stdio = ['ignore', 'pipe', 'pipe'];
    }
    const child = (0, child_process_1.spawn)(cmd, args, spawnOpts);
    if (child.stdout)
        child.stdout.pipe(outStream);
    if (child.stderr)
        child.stderr.pipe(outStream);
    child.on('error', (err) => logger_js_1.logger.error(`supervisor: ${name} process error ${err.message}`));
    child.on('exit', (code) => {
        logger_js_1.logger.warn(`supervisor: ${name} exited with ${code}`);
        if (procs[name])
            delete procs[name];
        persist();
    });
    // if detached, allow process to continue after this parent exits
    if (spawnOpts.detached) {
        try {
            child.unref();
        }
        catch { }
    }
    procs[name] = { name, pid: child.pid || -1, cmd, args, cwd: opts.cwd, log: logFile, detached: !!spawnOpts.detached };
    persist();
    return child;
}
function stopProcess(name) {
    const entry = procs[name];
    if (!entry)
        return false;
    try {
        process.kill(entry.pid, 'SIGTERM');
        try {
            delete procs[name];
            persist();
        }
        catch { }
        return true;
    }
    catch (err) {
        logger_js_1.logger.warn(`supervisor: failed to kill ${name} pid=${entry.pid} (${err})`);
        return false;
    }
}
function stopAll() {
    const names = Object.keys(procs);
    for (const n of names) {
        stopProcess(n);
    }
    try {
        if ((0, fs_1.existsSync)(STATE_FILE))
            (0, fs_1.unlinkSync)(STATE_FILE);
    }
    catch { }
}
function clearState() {
    procs = {};
    try {
        if ((0, fs_1.existsSync)(STATE_FILE))
            (0, fs_1.unlinkSync)(STATE_FILE);
    }
    catch { }
}
