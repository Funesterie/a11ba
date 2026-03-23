export type Lane = {
    id: number;
    name: string;
    url: string;
};
export declare const DEFAULT_LANES: Lane[];
type CircuitState = {
    failures: number;
    firstFailureTs?: number;
    trippedUntil?: number;
};
export declare function getPreferredLane(host: string): number | null;
export declare function setPreferredLane(host: string, laneId: number): void;
export declare function lanesForHost(host: string, lanes?: Lane[]): Lane[];
export declare function recordFailure(host: string, laneId: number, latencyMs?: number): void;
export declare function recordSuccess(host: string, laneId: number, latencyMs?: number): void;
export declare function isLaneTripped(host: string, laneId: number): boolean;
export type NpzRequest = {
    method?: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
};
export type NpzResponse = {
    status?: number;
    headers?: any;
    body?: string;
    error?: any;
    gate?: string;
    laneId?: number;
    durationMs?: number;
};
export declare function npzRoute(req: NpzRequest, lanes?: Lane[]): Promise<NpzResponse>;
export declare function getCircuitState(host: string): Record<number, CircuitState>;
declare const _default: {
    DEFAULT_LANES: Lane[];
    npzRoute: typeof npzRoute;
    getPreferredLane: typeof getPreferredLane;
    setPreferredLane: typeof setPreferredLane;
    lanesForHost: typeof lanesForHost;
    recordFailure: typeof recordFailure;
    recordSuccess: typeof recordSuccess;
    isLaneTripped: typeof isLaneTripped;
    getCircuitState: typeof getCircuitState;
};
export default _default;
