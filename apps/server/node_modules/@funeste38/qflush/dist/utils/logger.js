"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logger = {
    info: (msg) => console.log(`\x1b[36m[QFLASH]\x1b[0m ${msg}`),
    warn: (msg) => console.log(`\x1b[33m[QFLASH]\x1b[0m ${msg}`),
    error: (msg) => console.error(`\x1b[31m[QFLASH]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[QFLASH]\x1b[0m ${msg}`),
};
