"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRomeLinks = runRomeLinks;
const linker_js_1 = require("../rome/linker.js");
async function runRomeLinks(argv) {
    const projectRoot = process.cwd();
    const links = (0, linker_js_1.computeRomeLinks)(projectRoot);
    (0, linker_js_1.writeRomeLinks)(projectRoot, links);
    console.log(`rome-links: ${links.length} references enregistrées.`);
    if (argv && argv.includes('--interactive')) {
        console.log('interactive mode not implemented in CLI stub.');
    }
    return 0;
}
exports.default = runRomeLinks;
