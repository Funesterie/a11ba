export declare const ROME_TAG_VERSION = 1;
export declare const ROME_TAG_COMMENT_PREFIX = "// ROME-TAG:";
export interface RomeTagMeta {
    type: string;
    path: string;
    ext?: string;
}
export interface RomeTagRecord extends RomeTagMeta {
    tag: number;
    tagHex: string;
    savedAt: string;
    version: number;
}
export type RomeIndex = Record<string, RomeTagRecord>;
export declare function normalizeRomePath(p: string): string;
export declare function extractExt(p: string): string | undefined;
export declare function fnv1a24(str: string): number;
export declare function computeRomeTag(meta: RomeTagMeta): number;
export declare function toRomeTagHex(tag: number): string;
export declare function fromRomeTagHex(hex: string): number | null;
export declare function makeRomeTagRecord(meta: RomeTagMeta, date?: Date): RomeTagRecord;
export declare function getOrCreateRomeTag(index: RomeIndex, meta: RomeTagMeta, date?: Date): RomeTagRecord;
export declare function buildRomeTagComment(tag: number): string;
export declare function parseRomeTagComment(line: string): number | null;
