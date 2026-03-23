"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRunning = exports.clearState = exports.stopAll = exports.stopProcess = exports.startProcess = void 0;
// Re-export supervisor API implemented in src/supervisor/index.ts
var index_js_1 = require("./supervisor/index.js");
Object.defineProperty(exports, "startProcess", { enumerable: true, get: function () { return index_js_1.startProcess; } });
Object.defineProperty(exports, "stopProcess", { enumerable: true, get: function () { return index_js_1.stopProcess; } });
Object.defineProperty(exports, "stopAll", { enumerable: true, get: function () { return index_js_1.stopAll; } });
Object.defineProperty(exports, "clearState", { enumerable: true, get: function () { return index_js_1.clearState; } });
Object.defineProperty(exports, "listRunning", { enumerable: true, get: function () { return index_js_1.listRunning; } });
