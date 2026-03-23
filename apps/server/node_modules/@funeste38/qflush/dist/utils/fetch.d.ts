export type FetchInit = {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
};
export declare function fetchWrapper(url: string, init?: FetchInit): Promise<any>;
export default fetchWrapper;
