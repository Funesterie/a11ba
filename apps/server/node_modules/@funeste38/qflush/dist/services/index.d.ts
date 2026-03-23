export type ServiceEntry = {
    start: (opts?: any) => Promise<void>;
    stop?: () => Promise<void>;
};
export declare const ServiceState: Record<string, {
    running: boolean;
    lastError: any | null;
    lastStart: number | null;
    idle?: boolean;
}>;
export declare const GlobalState: {
    sleep?: boolean;
};
export declare function listAvailableServices(): string[];
export declare function startService(name: string, opts?: any): Promise<void>;
export declare function stopService(name: string): Promise<void>;
export declare function enterSleepMode(): void;
export declare function exitSleepMode(): void;
export declare function jokerWipe(): Promise<void>;
export declare function getServiceClients(): any;
