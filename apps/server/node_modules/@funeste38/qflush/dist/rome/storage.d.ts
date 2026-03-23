export declare function saveTelemetryEvent(id: string, type: string, timestamp: number, payload: any): boolean;
export declare function getRecentTelemetry(limit?: number): any;
export declare function saveEngineHistory(id: string, timestamp: number, pathVal: string, action: string, result: any): boolean;
export declare function getEngineHistory(limit?: number): any;
