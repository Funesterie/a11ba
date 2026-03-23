type NpzRecord = {
    id: string;
    laneId?: number;
    ts: number;
    meta?: Record<string, any>;
};
export declare function createRequestRecord(idOrMeta?: string | Record<string, any>, maybeMeta?: Record<string, any>): Promise<{
    id: string;
    laneId?: number;
    ts: number;
    meta?: Record<string, any>;
}>;
export declare function updateRequestRecord(id: string, patch: Partial<NpzRecord>): Promise<NpzRecord | null>;
export declare function getRequestRecord(id: string): Promise<NpzRecord | null>;
declare const _default: {
    createRequestRecord: typeof createRequestRecord;
    updateRequestRecord: typeof updateRequestRecord;
    getRequestRecord: typeof getRequestRecord;
};
export default _default;
