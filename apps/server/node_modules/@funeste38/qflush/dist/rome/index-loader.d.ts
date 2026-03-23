import { RomeIndex } from './rome-tag.js';
export declare function loadRomeIndexFromDisk(): RomeIndex;
export declare function getCachedRomeIndex(): RomeIndex;
export declare function startRomeIndexAutoRefresh(intervalMs?: number): void;
export declare function onRomeIndexUpdated(cb: (payload: any) => void): void;
