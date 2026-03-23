export type QFlushOptions = {
    global?: Record<string, any>;
    modulePaths?: Record<string, string>;
    tokens?: Record<string, string>;
    flags?: Record<string, boolean | string>;
    detected?: Record<string, any>;
    services?: string[];
};
export declare function buildPipeline(argv: string[]): {
    pipeline: string[];
    options: {
        flags: Record<string, string | boolean>;
        modulePaths: Record<string, string>;
        tokens: Record<string, string>;
        global: any;
        services: string[];
    };
} | {
    pipeline: string[];
    options: QFlushOptions;
};
export declare function executePipeline(pipeline: string[], options: QFlushOptions): Promise<void>;
