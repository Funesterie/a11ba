export type ResolveResult = {
    gate: 'green' | 'yellow' | 'dlx' | 'fail';
    cmd?: string;
    args?: string[];
    cwd?: string;
};
export declare function npzResolve(nameOrPkg: string, opts?: {
    cwd?: string;
}): ResolveResult;
export declare function runResolved(res: ResolveResult): {
    ok: boolean;
    status?: number;
};
declare const _default: {
    npzResolve: typeof npzResolve;
    runResolved: typeof runResolved;
};
export default _default;
