export type LicenseRecord = {
    key: string;
    product_id?: string;
    valid?: boolean;
    expires_at?: string | null;
    verifiedAt?: number;
};
export declare function readLicense(): LicenseRecord | null;
export declare function saveLicense(rec: LicenseRecord): boolean;
export declare function activateLicense(key: string, productId?: string): Promise<{
    ok: boolean;
    license: LicenseRecord;
    raw: any;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    license?: undefined;
    raw?: undefined;
}>;
declare const _default: {
    readLicense: typeof readLicense;
    saveLicense: typeof saveLicense;
    activateLicense: typeof activateLicense;
};
export default _default;
