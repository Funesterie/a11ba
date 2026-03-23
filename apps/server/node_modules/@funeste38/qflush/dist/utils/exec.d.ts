export declare function spawnSafe(command: string, args?: string[], opts?: any): import("child_process").ChildProcessWithoutNullStreams;
export declare function rimrafSync(path: string): void;
export declare function isPackageInstalled(pkgName: string): boolean;
export declare function ensurePackageInstalled(pkgName: string): boolean;
export declare function pathExists(pathStr: string): boolean;
export declare function rebuildInstructionsFor(pkgPath?: string): string;
