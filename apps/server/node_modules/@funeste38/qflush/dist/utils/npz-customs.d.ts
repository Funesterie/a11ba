export type ModuleDescriptor = {
    name: string;
    pkg?: string;
    cwd: string;
    requiredEnv?: string[];
    requiredFiles?: string[];
    requiredPorts?: number[];
};
export type CustomsIssue = {
    level: 'info' | 'warning' | 'block';
    code: string;
    message: string;
};
export type CustomsReport = {
    module: string;
    issues: CustomsIssue[];
};
export type CustomsScanner = (mod: ModuleDescriptor) => Promise<CustomsIssue[]>;
export declare const MODULES: ModuleDescriptor[];
export declare const envScanner: CustomsScanner;
export declare const fileScanner: CustomsScanner;
export declare const portScanner: CustomsScanner;
export declare function runCustomsCheck(mod: ModuleDescriptor): Promise<CustomsReport>;
export declare function hasBlockingIssues(report: CustomsReport): boolean;
declare const _default: {
    MODULES: ModuleDescriptor[];
    runCustomsCheck: typeof runCustomsCheck;
    hasBlockingIssues: typeof hasBlockingIssues;
};
export default _default;
