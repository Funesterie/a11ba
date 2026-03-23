export type AiMode = 'cloud' | 'local' | 'auto';
export interface QflushAiOptions {
    prompt: string;
    profile?: string;
    mode?: AiMode;
}
export declare function qflushAi(options: QflushAiOptions): Promise<string>;
