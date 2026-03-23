export type LicenseRecord = {
    key: string;
    product_id: string;
    createdAt: number;
    expiresAt?: number | null;
    recurring?: boolean;
    lastVerified?: number;
    metadata?: Record<string, any>;
};
export declare function saveLicense(rec: LicenseRecord): void;
export declare function loadLicense(): LicenseRecord | null;
export declare function readTokenFromFile(): string | null;
export declare function verifyWithGumroad(product_id: string, licenseKey: string, token: string): Promise<any>;
export declare function isLicenseValid(rec: LicenseRecord | null): boolean;
export declare function activateLicense(product_id: string, licenseKey: string, token: string): Promise<{
    key: string;
    product_id: string;
    createdAt: number;
    expiresAt: number | null;
    recurring: boolean;
    lastVerified: number;
    metadata: any;
}>;
export declare function clearLicense(): void;
declare const _default: {
    saveLicense: typeof saveLicense;
    loadLicense: typeof loadLicense;
    verifyWithGumroad: typeof verifyWithGumroad;
    activateLicense: typeof activateLicense;
    isLicenseValid: typeof isLicenseValid;
    clearLicense: typeof clearLicense;
    readTokenFromFile: typeof readTokenFromFile;
};
export default _default;
