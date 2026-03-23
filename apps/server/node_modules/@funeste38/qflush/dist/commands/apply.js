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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = runApply;
// src/commands/apply.ts
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_js_1 = require("../utils/logger.js");
const pngCodec_js_1 = require("../cortex/pngCodec.js");
const applyPacket_js_1 = require("../cortex/applyPacket.js");
async function runApply(argv = []) {
    try {
        const approveAll = argv.includes('--approve') || argv.includes('-a');
        const approveIdArg = argv.find(a => a.startsWith('--approve-id='));
        const approveId = approveIdArg ? approveIdArg.split('=')[1] : null;
        const qflushDir = path.join(process.cwd(), '.qflush');
        if (!fs.existsSync(qflushDir))
            fs.mkdirSync(qflushDir, { recursive: true });
        // 1) Ensure spyder.config.json exists
        const spyCfgPath = path.join(qflushDir, 'spyder.config.json');
        if (!fs.existsSync(spyCfgPath)) {
            const defaultCfg = { enabled: false, frequency: 'passive', routes: [] };
            fs.writeFileSync(spyCfgPath, JSON.stringify(defaultCfg, null, 2), 'utf8');
            logger_js_1.logger.info('Created default .qflush/spyder.config.json');
        }
        else {
            logger_js_1.logger.info('.qflush/spyder.config.json already present');
        }
        // 2) Synchronize cortex/PacketRouter mapping
        let cortexRoutes = {};
        try {
            // require router module to discover known actions
            const router = require('../cortex/router');
            const keys = router && router.cortexActions ? Object.keys(router.cortexActions) : [];
            for (const k of keys)
                cortexRoutes[k] = true; // default enable known actions
        }
        catch (e) {
            logger_js_1.logger.warn('Could not require cortex/router to sync routes: ' + String(e));
        }
        const cortexRoutesPath = path.join(qflushDir, 'cortex.routes.json');
        try {
            fs.writeFileSync(cortexRoutesPath, JSON.stringify({ cortexActions: cortexRoutes }, null, 2), 'utf8');
            logger_js_1.logger.info('Wrote .qflush/cortex.routes.json');
        }
        catch (e) {
            logger_js_1.logger.warn('Failed to write cortex.routes.json: ' + String(e));
        }
        // 3) Generate supporting files if missing
        const lastPath = path.join(qflushDir, 'cortex.last.json');
        const cachePath = path.join(qflushDir, 'spyder.cache.json');
        try {
            if (!fs.existsSync(lastPath))
                fs.writeFileSync(lastPath, JSON.stringify({ initializedAt: new Date().toISOString() }, null, 2), 'utf8');
        }
        catch (e) {
            logger_js_1.logger.warn('[apply] ensure lastPath write failed: ' + String(e));
        }
        try {
            if (!fs.existsSync(cachePath))
                fs.writeFileSync(cachePath, JSON.stringify({ createdAt: new Date().toISOString(), items: [] }, null, 2), 'utf8');
        }
        catch (e) {
            logger_js_1.logger.warn('[apply] ensure cachePath write failed: ' + String(e));
        }
        // 4) Scan incoming JSON and PNG packets
        const incomingJsonDir = path.join(qflushDir, 'incoming', 'json');
        const incomingPngDir = path.join(qflushDir, 'incoming', 'png');
        const collected = [];
        if (fs.existsSync(incomingJsonDir)) {
            for (const f of fs.readdirSync(incomingJsonDir)) {
                if (!f.endsWith('.json'))
                    continue;
                try {
                    const raw = fs.readFileSync(path.join(incomingJsonDir, f), 'utf8');
                    const j = JSON.parse(raw);
                    if (j && j.kind === 'cortex-packet') {
                        collected.push({ pkt: j, src: path.join(incomingJsonDir, f) });
                        logger_js_1.logger.info('Queued incoming JSON packet: ' + (j.id || '[no-id]'));
                    }
                    else {
                        logger_js_1.logger.warn('Skipping JSON not matching cortex-packet: ' + f);
                    }
                }
                catch (e) {
                    logger_js_1.logger.warn('Failed to parse incoming json ' + f + ': ' + String(e));
                }
            }
        }
        if (fs.existsSync(incomingPngDir)) {
            for (const f of fs.readdirSync(incomingPngDir)) {
                if (!f.endsWith('.png'))
                    continue;
                try {
                    const pkt = await (0, pngCodec_js_1.decodeCortexPacketFromPng)(path.join(incomingPngDir, f));
                    collected.push({ pkt, src: path.join(incomingPngDir, f) });
                    logger_js_1.logger.info('Decoded incoming PNG packet: ' + (pkt.id || '[no-id]'));
                }
                catch (e) {
                    logger_js_1.logger.warn('Failed to decode incoming png ' + f + ': ' + String(e));
                }
            }
        }
        // Apply collected packets
        const processedDir = path.join(qflushDir, 'processed');
        if (!fs.existsSync(processedDir))
            fs.mkdirSync(processedDir, { recursive: true });
        for (const entry of collected) {
            const pkt = entry.pkt;
            try {
                // if approve flags present, inject into packet payload when AUTO-PATCH
                if (approveAll) {
                    try {
                        if (!pkt.payload)
                            pkt.payload = {};
                        pkt.payload.approve = true;
                    }
                    catch (e) {
                        logger_js_1.logger.warn('[apply] inject approve failed: ' + String(e));
                    }
                }
                if (approveId && pkt.id === approveId) {
                    try {
                        if (!pkt.payload)
                            pkt.payload = {};
                        pkt.payload.approve = true;
                    }
                    catch (e) {
                        logger_js_1.logger.warn('[apply] inject approveId failed: ' + String(e));
                    }
                }
                logger_js_1.logger.info('Applying packet: ' + pkt.type + ' ' + (pkt.id || ''));
                await (0, applyPacket_js_1.applyCortexPacket)(pkt);
                const last = { appliedAt: new Date().toISOString(), packet: pkt };
                fs.writeFileSync(lastPath, JSON.stringify(last, null, 2), 'utf8');
                // archive original source file into dated folder
                try {
                    if (entry.src && fs.existsSync(entry.src)) {
                        const m = new Date();
                        const y = m.getFullYear();
                        const mm = String(m.getMonth() + 1).padStart(2, '0');
                        const archiveDir = path.join(processedDir, `${y}-${mm}`);
                        if (!fs.existsSync(archiveDir))
                            fs.mkdirSync(archiveDir, { recursive: true });
                        const base = path.basename(entry.src);
                        const dest = path.join(archiveDir, `${Date.now()}-${base}`);
                        try {
                            fs.renameSync(entry.src, dest);
                        }
                        catch (e) {
                            try {
                                fs.copyFileSync(entry.src, dest);
                            }
                            catch (e2) {
                                logger_js_1.logger.warn('[apply] copy entry.src failed: ' + String(e2));
                            }
                            try {
                                fs.unlinkSync(entry.src);
                            }
                            catch (e) {
                                logger_js_1.logger.warn('[apply] unlink original failed: ' + String(e));
                            }
                        }
                        // write metadata
                        try {
                            fs.writeFileSync(dest + '.applied.json', JSON.stringify({ appliedAt: new Date().toISOString(), packetId: pkt.id || null }, null, 2), 'utf8');
                        }
                        catch (e) {
                            logger_js_1.logger.warn('[apply] write applied metadata failed: ' + String(e));
                        }
                    }
                    else {
                        // if no src, write packet copy
                        const id = pkt.id || (`manual-${Date.now()}`);
                        const target = path.join(processedDir, `${id}.json`);
                        fs.writeFileSync(target, JSON.stringify(pkt, null, 2), 'utf8');
                    }
                }
                catch (e) {
                    logger_js_1.logger.warn('[apply] archive step failed: ' + String(e));
                }
            }
            catch (e) {
                logger_js_1.logger.warn('Failed to apply packet: ' + String(e));
                // move to failed folder if source exists
                try {
                    if (entry.src && fs.existsSync(entry.src)) {
                        const failDir = path.join(qflushDir, 'failed');
                        const m = new Date();
                        const y = m.getFullYear();
                        const mm = String(m.getMonth() + 1).padStart(2, '0');
                        const archiveDir = path.join(failDir, `${y}-${mm}`);
                        if (!fs.existsSync(archiveDir))
                            fs.mkdirSync(archiveDir, { recursive: true });
                        const base = path.basename(entry.src);
                        const dest = path.join(archiveDir, `${Date.now()}-${base}`);
                        try {
                            fs.renameSync(entry.src, dest);
                        }
                        catch (e) {
                            fs.copyFileSync(entry.src, dest);
                            try {
                                fs.unlinkSync(entry.src);
                            }
                            catch (e) { }
                        }
                        try {
                            fs.writeFileSync(dest + '.error.json', JSON.stringify({ error: String(e), when: new Date().toISOString() }, null, 2), 'utf8');
                        }
                        catch (e) { }
                    }
                }
                catch (_) {
                    logger_js_1.logger.warn('[apply] move to failed folder encountered an error');
                }
            }
        }
        // 5) Ensure that SPYDER is wired into lifecycle: update spyder.config.json.routes with cortexRoutes keys
        try {
            const raw = fs.readFileSync(spyCfgPath, 'utf8');
            const spyCfg = JSON.parse(raw || '{}');
            spyCfg.routes = Object.keys(cortexRoutes);
            fs.writeFileSync(spyCfgPath, JSON.stringify(spyCfg, null, 2), 'utf8');
            logger_js_1.logger.info('Updated spyder.config.json routes');
        }
        catch (e) {
            logger_js_1.logger.warn('Failed to update spyder.config.json routes: ' + String(e));
        }
        // cleanup old archives (keep default 6 months unless configured)
        try {
            const archiveUtils = require('../utils/archive');
            const keep = process.env.QFLUSH_ARCHIVE_KEEP_MONTHS ? Number(process.env.QFLUSH_ARCHIVE_KEEP_MONTHS) : 6;
            try {
                archiveUtils.cleanupDatedArchives(path.join(qflushDir, 'processed'), keep);
            }
            catch (e) {
                logger_js_1.logger.warn('[apply] cleanup processed archives failed: ' + String(e));
            }
            try {
                archiveUtils.cleanupDatedArchives(path.join(qflushDir, 'failed'), keep);
            }
            catch (e) {
                logger_js_1.logger.warn('[apply] cleanup failed archives failed: ' + String(e));
            }
        }
        catch (e) { }
        logger_js_1.logger.success('qflush apply complete — SPYDER initialized and cortex routes synchronized');
        return 0;
    }
    catch (e) {
        console.error('qflush apply failed', e);
        return 1;
    }
}
