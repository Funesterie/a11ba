"use strict";
// Utilities for Nezlephant color palette and helpers
// Base color shorthand '0c8' -> #00cc88
Object.defineProperty(exports, "__esModule", { value: true });
exports.ansiReset = exports.NEZLEPHANT = void 0;
exports.hexToRgb = hexToRgb;
exports.rgbToHex = rgbToHex;
exports.rgba = rgba;
exports.lighten = lighten;
exports.darken = darken;
exports.relativeLuminance = relativeLuminance;
exports.contrastRatio = contrastRatio;
exports.readableTextColor = readableTextColor;
exports.cssVariables = cssVariables;
exports.ansiFg = ansiFg;
exports.ansiBg = ansiBg;
exports.styledLog = styledLog;
exports.NEZLEPHANT = {
    baseHex: '#00cc88', // shorthand 0c8
    jokerHex: '#ff00cc', // Joker accent (magenta-pink)
    neutralHex: '#0f1724', // dark neutral
    whiteHex: '#ffffff',
    blackHex: '#000000',
};
function clamp(v, a = 0, b = 255) {
    return Math.max(a, Math.min(b, Math.round(v)));
}
function hexToRgb(hex) {
    const h = hex.replace('#', '');
    if (h.length === 3) {
        const r = Number.parseInt(h[0] + h[0], 16);
        const g = Number.parseInt(h[1] + h[1], 16);
        const b = Number.parseInt(h[2] + h[2], 16);
        return { r, g, b };
    }
    const r = Number.parseInt(h.slice(0, 2), 16);
    const g = Number.parseInt(h.slice(2, 4), 16);
    const b = Number.parseInt(h.slice(4, 6), 16);
    return { r, g, b };
}
function rgbToHex(r, g, b) {
    return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('')}`;
}
function rgba(hex, alpha = 1) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function lighten(hex, percent = 0.1) {
    const { r, g, b } = hexToRgb(hex);
    const nr = clamp(r + (255 - r) * percent);
    const ng = clamp(g + (255 - g) * percent);
    const nb = clamp(b + (255 - b) * percent);
    return rgbToHex(nr, ng, nb);
}
function darken(hex, percent = 0.1) {
    const { r, g, b } = hexToRgb(hex);
    const nr = clamp(r * (1 - percent));
    const ng = clamp(g * (1 - percent));
    const nb = clamp(b * (1 - percent));
    return rgbToHex(nr, ng, nb);
}
function relativeLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const srgb = [r / 255, g / 255, b / 255].map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}
function contrastRatio(hexA, hexB) {
    const L1 = relativeLuminance(hexA) + 0.05;
    const L2 = relativeLuminance(hexB) + 0.05;
    return Math.max(L1, L2) / Math.min(L1, L2);
}
function readableTextColor(backgroundHex, prefer = exports.NEZLEPHANT.whiteHex) {
    // return white or black depending on contrast
    const whiteContrast = contrastRatio(backgroundHex, exports.NEZLEPHANT.whiteHex);
    const blackContrast = contrastRatio(backgroundHex, exports.NEZLEPHANT.blackHex);
    return whiteContrast >= blackContrast ? exports.NEZLEPHANT.whiteHex : exports.NEZLEPHANT.blackHex;
}
function cssVariables(prefix = 'nez') {
    const base = exports.NEZLEPHANT.baseHex;
    const j = exports.NEZLEPHANT.jokerHex;
    return `:root {\n  --${prefix}-base: ${base};\n  --${prefix}-base-90: ${rgba(base, 0.9)};\n  --${prefix}-base-80: ${rgba(base, 0.8)};\n  --${prefix}-base-60: ${rgba(base, 0.6)};\n  --${prefix}-base-30: ${rgba(base, 0.3)};\n  --${prefix}-light: ${lighten(base, 0.18)};\n  --${prefix}-dark: ${darken(base, 0.18)};\n  --${prefix}-joker: ${j};\n  --${prefix}-bg: ${exports.NEZLEPHANT.neutralHex};\n  --${prefix}-text: ${readableTextColor(exports.NEZLEPHANT.neutralHex)};\n}`;
}
// Terminal ANSI truecolor helpers (supports modern terminals)
function ansiFg(hex) {
    const { r, g, b } = hexToRgb(hex);
    return `\x1b[38;2;${r};${g};${b}m`;
}
function ansiBg(hex) {
    const { r, g, b } = hexToRgb(hex);
    return `\x1b[48;2;${r};${g};${b}m`;
}
exports.ansiReset = '\x1b[0m';
// Preset styled log helpers for Joker + Nezlephant
function styledLog(title, msg, opts) {
    let accent = exports.NEZLEPHANT.baseHex;
    if (opts?.accent === 'joker')
        accent = exports.NEZLEPHANT.jokerHex;
    else if (opts?.accent === 'neutral')
        accent = exports.NEZLEPHANT.neutralHex;
    const bg = ansiBg(darken(accent, 0.15));
    const fg = ansiFg(readableTextColor(darken(accent, 0.15)));
    const accentFg = ansiFg(accent);
    // If output is not a TTY or NO_COLOR is set, avoid ANSI color sequences and print plain text
    if (process.env.NO_COLOR || !(process.stdout && process.stdout.isTTY)) {
        process.stdout.write(`[${title}] ${msg}\n`);
        return;
    }
    process.stdout.write(`${bg}${fg} [${title}] ${exports.ansiReset} ${accentFg}${msg}${exports.ansiReset}\n`);
}
exports.default = {
    NEZLEPHANT: exports.NEZLEPHANT,
    hexToRgb,
    rgbToHex,
    rgba,
    lighten,
    darken,
    readableTextColor,
    cssVariables,
    ansiFg,
    ansiBg,
    ansiReset: exports.ansiReset,
    styledLog,
};
