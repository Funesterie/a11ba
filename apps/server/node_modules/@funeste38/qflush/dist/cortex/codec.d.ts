export declare function crc8_oc8(data: Buffer, poly?: number, init?: number): number;
export declare function buildCortexPacket(raw: Buffer, flags?: number): Buffer;
export declare function parseCortexPacket(buf: Buffer): {
    totalLen: number;
    payloadLen: number;
    flags: number;
    raw: NonSharedBuffer;
};
export declare function encodePacketToPNGs(packet: Buffer, outputPrefix: string, maxPngBytes?: number): Promise<string[]>;
export declare function decodePNGsToPacket(paths: string[]): Promise<Buffer>;
export declare function encodeFileToPNGs(inputPath: string, outputPrefix: string): Promise<string[]>;
export declare function decodePNGsToFile(pngGlobPaths: string[], outputPath: string): Promise<void>;
export declare function decodeCortexPacket(buf: Buffer): {
    totalLen: number;
    payloadLen: number;
    flags: number;
    payload: any;
};
declare const _default: {
    buildCortexPacket: typeof buildCortexPacket;
    parseCortexPacket: typeof parseCortexPacket;
    decodeCortexPacket: typeof decodeCortexPacket;
    encodePacketToPNGs: typeof encodePacketToPNGs;
    decodePNGsToPacket: typeof decodePNGsToPacket;
};
export default _default;
