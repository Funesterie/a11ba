export declare const NEZLEPHANT: {
    baseHex: string;
    jokerHex: string;
    neutralHex: string;
    whiteHex: string;
    blackHex: string;
};
export declare function hexToRgb(hex: string): {
    r: number;
    g: number;
    b: number;
};
export declare function rgbToHex(r: number, g: number, b: number): string;
export declare function rgba(hex: string, alpha?: number): string;
export declare function lighten(hex: string, percent?: number): string;
export declare function darken(hex: string, percent?: number): string;
export declare function relativeLuminance(hex: string): number;
export declare function contrastRatio(hexA: string, hexB: string): number;
export declare function readableTextColor(backgroundHex: string, prefer?: string): string;
export declare function cssVariables(prefix?: string): string;
export declare function ansiFg(hex: string): string;
export declare function ansiBg(hex: string): string;
export declare const ansiReset = "\u001B[0m";
export declare function styledLog(title: string, msg: string, opts?: {
    accent?: 'joker' | 'base' | 'neutral';
}): void;
declare const _default: {
    NEZLEPHANT: {
        baseHex: string;
        jokerHex: string;
        neutralHex: string;
        whiteHex: string;
        blackHex: string;
    };
    hexToRgb: typeof hexToRgb;
    rgbToHex: typeof rgbToHex;
    rgba: typeof rgba;
    lighten: typeof lighten;
    darken: typeof darken;
    readableTextColor: typeof readableTextColor;
    cssVariables: typeof cssVariables;
    ansiFg: typeof ansiFg;
    ansiBg: typeof ansiBg;
    ansiReset: string;
    styledLog: typeof styledLog;
};
export default _default;
