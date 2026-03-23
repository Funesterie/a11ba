export type RouteInfo = {
    enabled?: boolean;
    score?: number;
    [k: string]: any;
};
export declare function loadRoutesConfig(): Record<string, RouteInfo> | null;
export declare function isRouteEnabled(name: string): boolean;
export declare function getRouteScore(name: string): number;
export declare function pickBestRoute(candidates: string[]): string | null;
declare const _default: {
    loadRoutesConfig: typeof loadRoutesConfig;
    isRouteEnabled: typeof isRouteEnabled;
    getRouteScore: typeof getRouteScore;
    pickBestRoute: typeof pickBestRoute;
};
export default _default;
