import { EventEmitter } from 'events';
export type LinkRef = {
    from: string;
    line: number;
    token: string;
    target: string | null;
    score: number;
};
export declare const romeLinksEmitter: EventEmitter<[never]>;
export declare function computeRomeLinks(projectRoot: string): LinkRef[];
export declare function computeRomeLinksForFiles(projectRoot: string, absFiles: string[]): LinkRef[];
export declare function resolveRomeToken(projectRoot: string, fromPath: string, token: string): {
    path: string | null;
    score: number;
};
export declare function writeRomeLinks(projectRoot: string, links: LinkRef[]): void;
export declare function readExistingLinks(projectRoot: string): LinkRef[];
export declare function mergeAndWrite(projectRoot: string, newLinks: LinkRef[]): void;
