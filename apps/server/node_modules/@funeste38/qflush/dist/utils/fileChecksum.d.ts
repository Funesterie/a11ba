export declare function xorChecksum(buffer: Uint8Array | Buffer): number;
export declare function checksumBufferIgnoringRomeTag(buf: Buffer | Uint8Array): number;
export declare function checksumFileIgnoringRomeTag(filePath: string): number;
export declare function flexibleChecksumBuffer(buf: Buffer | Uint8Array): Promise<number>;
export declare function flexibleChecksumFile(filePath: string): Promise<number>;
declare const _default: {
    xorChecksum: typeof xorChecksum;
    checksumBufferIgnoringRomeTag: typeof checksumBufferIgnoringRomeTag;
    checksumFileIgnoringRomeTag: typeof checksumFileIgnoringRomeTag;
    flexibleChecksumBuffer: typeof flexibleChecksumBuffer;
    flexibleChecksumFile: typeof flexibleChecksumFile;
};
export default _default;
