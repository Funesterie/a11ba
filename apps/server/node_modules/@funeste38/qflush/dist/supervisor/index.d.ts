type ProcRecord = {
    name: string;
    pid: number;
    cmd: string;
    args: string[];
    cwd?: string;
    log?: string;
    detached?: boolean;
};
export declare function listRunning(): ProcRecord[];
export declare function startProcess(name: string, cmd: string, args?: string[], opts?: any): import("child_process").ChildProcessWithoutNullStreams;
export declare function stopProcess(name: string): boolean;
export declare function stopAll(): void;
export declare function clearState(): void;
export {};
