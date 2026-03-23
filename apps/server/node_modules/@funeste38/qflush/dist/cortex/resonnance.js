"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resonnance = resonnance;
// src/cortex/resonnance.ts
const listener_js_1 = require("./listener.js");
async function resonnance() {
    // Tu peux logger un petit rituel SPYDER ici 😈
    console.log('[CORTEX] Résonnance SPYDER activée…');
    console.log('[CORTEX] En attente de paquets (enable-spyder, cortex-packet, etc.)');
    await (0, listener_js_1.startCortexListener)();
}
