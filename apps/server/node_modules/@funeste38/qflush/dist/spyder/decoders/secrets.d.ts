export type SecretMatch = {
    pattern: string;
    line: number;
    index: number;
    snippet: string;
};
export declare function scanFileForSecrets(filePath: string): Promise<SecretMatch[]>;
