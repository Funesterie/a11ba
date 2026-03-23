export declare function isA11Available(): Promise<{
    ok: boolean;
    reason: string;
    detail?: undefined;
} | {
    ok: boolean;
    detail: any;
    reason?: undefined;
}>;
export declare function askA11(prompt: string, opts?: {
    model?: string;
}): Promise<any>;
