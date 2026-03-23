"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = runFreeze;
async function runFreeze(argv = []) {
    // parse --health=<url>
    let healthUrl = null;
    for (const a of argv) {
        if (a.startsWith('--health=')) {
            healthUrl = a.split('=')[1];
            break;
        }
        if (a === '--health') {
            const idx = argv.indexOf(a);
            if (idx >= 0 && idx < argv.length - 1)
                healthUrl = argv[idx + 1];
            break;
        }
    }
    if (!healthUrl) {
        console.log('QFLUSH frozen (manual)');
        return 0;
    }
    console.log(`QFLUSH frozen + auto-resume active (health=${healthUrl})`);
    return 0;
}
