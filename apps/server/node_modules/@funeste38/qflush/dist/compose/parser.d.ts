export type ModuleDef = {
    path?: string;
    port?: number;
    token?: string;
    env?: Record<string, string>;
};
export type ComposeFile = {
    modules: Record<string, ModuleDef>;
};
export declare function readCompose(file?: string): ComposeFile | null;
