import { Lane } from './npz-router.js';
type ScoreRecord = {
    laneId: number;
    score: number;
    lastSuccess?: number;
    lastFailure?: number;
};
type EngineStore = Record<number, ScoreRecord>;
/**
 * Adjust lane score.
 * delta: positive increases penalty (worse), negative decreases (better).
 * latencyMs: optional latency observed to weight the delta.
 */
export declare function scoreLane(laneId: number, delta: number, latencyMs?: number): void;
export declare function getLaneScore(laneId: number): number;
export declare function orderLanesByScore(lanes: Lane[]): Lane[];
export declare function resetScores(): void;
export declare function getStore(): EngineStore;
declare const _default: {
    scoreLane: typeof scoreLane;
    getLaneScore: typeof getLaneScore;
    orderLanesByScore: typeof orderLanesByScore;
    resetScores: typeof resetScores;
    getStore: typeof getStore;
};
export default _default;
