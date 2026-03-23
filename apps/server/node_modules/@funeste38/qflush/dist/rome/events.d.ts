import { EventEmitter } from 'events';
export declare function getEmitter(): EventEmitter<[never]>;
export declare function startIndexWatcher(intervalMs?: number): void;
export declare function emitRomeIndexUpdated(oldIndex: any, newIndex: any): void;
