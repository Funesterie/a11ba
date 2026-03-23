import { CortexPacket } from './types.js';
export interface EncodePngOptions {
    width?: number;
    redCurtainMode?: boolean;
}
export declare function encodeCortexPacketToPng(packet: CortexPacket, outputPath: string, options?: EncodePngOptions): Promise<void>;
export declare function decodeCortexPacketFromPng(inputPath: string): Promise<CortexPacket>;
