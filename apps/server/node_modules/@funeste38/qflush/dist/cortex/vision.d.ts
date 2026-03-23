export declare function processVisionImage(pngPath: string): Promise<{
    source: string;
    packet: import("./types.js").CortexPacket;
    processedAt: string;
}>;
declare const _default: {
    processVisionImage: typeof processVisionImage;
};
export default _default;
