export declare function httpProbe(url: string, timeout?: number): Promise<boolean>;
export declare function tcpProbe(host: string, port: number, timeout?: number): Promise<boolean>;
export declare function waitForService(urlOrHost: string, port?: number, timeout?: number): Promise<boolean>;
