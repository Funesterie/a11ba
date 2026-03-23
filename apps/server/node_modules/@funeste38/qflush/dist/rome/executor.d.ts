export declare function executeAction(action: string, ctx?: any): Promise<any>;
export declare function execCommand(cmd: string, args?: string[]): Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
}>;
