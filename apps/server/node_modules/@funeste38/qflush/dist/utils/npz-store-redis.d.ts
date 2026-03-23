type RedisNpzRecord = {
    id: string;
    laneId?: number;
    ts: number;
    meta?: Record<string, any>;
};
export declare function createRecord(meta?: Record<string, any>): Promise<RedisNpzRecord>;
export declare function updateRecord(id: string, patch: Partial<RedisNpzRecord>): Promise<(RedisNpzRecord & {
    expiresAt?: number;
} & Partial<RedisNpzRecord>) | null>;
export declare function getRecord(id: string): Promise<(RedisNpzRecord & {
    expiresAt?: number;
}) | null>;
export declare function deleteRecord(id: string): Promise<boolean>;
export declare function listRecords(): Promise<RedisNpzRecord[]>;
export declare function clearAll(): Promise<number>;
export declare function __internal_size(): number;
export {};
