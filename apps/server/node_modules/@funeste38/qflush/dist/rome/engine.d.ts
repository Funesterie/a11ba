import { RomeIndex } from './rome-tag.js';
export type EngineAction = {
    action: 'watch';
    path: string;
    reason?: string;
} | {
    action: 'start-service';
    service: string;
    path?: string;
} | {
    action: 'encode-npz';
    path: string;
    codec?: string;
} | {
    action: 'noop';
    path?: string;
};
/**
 * Simple rule engine for Rome index v1.
 * Rules are evaluated in order and produce a list of actions.
 */
export declare function evaluateIndex(index: RomeIndex): EngineAction[];
export declare function computeEngineActionsSafe(index?: RomeIndex): EngineAction[];
export declare const computeEngineActions: typeof computeEngineActionsSafe;
