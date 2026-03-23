export type SecretOpts = {
    fileEnv?: string;
    required?: boolean;
    cliAlias?: string;
};
export declare function getSecret(name: string, opts?: SecretOpts): string | undefined;
