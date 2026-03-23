"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = runVision;
const vision_js_1 = __importDefault(require("../cortex/vision.js"));
async function runVision(argv = []) {
    const file = argv[0];
    if (!file) {
        console.log('usage: qflush vision <png-path>');
        return 1;
    }
    try {
        const res = await vision_js_1.default.processVisionImage(file);
        console.log('vision processed, output written to .qflush/spyder-vision.json');
        return 0;
    }
    catch (e) {
        console.error('vision failed', e);
        return 2;
    }
}
