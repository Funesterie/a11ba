export type ScoreRecord = {
    laneId: number;
    score: number;
    lastSuccess?: number;
    lastFailure?: number;
};
export declare function getScores(): ScoreRecord[];
export declare function resetScores(): void;
export declare function getOrderedLanes(lanes: {
    id: number;
}[]): import("../../utils/npz-router.js").Lane[];
declare const _default: {
    getScores: typeof getScores;
    resetScores: typeof resetScores;
    getOrderedLanes: typeof getOrderedLanes;
};
export default _default;
