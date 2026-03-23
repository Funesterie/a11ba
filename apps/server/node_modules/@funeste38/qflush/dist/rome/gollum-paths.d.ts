export interface GollumOptions {
    root?: string;
    indexFile?: string;
}
interface RomeIndex {
    aliases?: Record<string, string>;
    services?: Record<string, {
        path: string;
    }>;
}
/**
 * Charge l’index Rome (aliases / services).
 */
export declare function loadRomeIndex(opts?: GollumOptions): RomeIndex;
/**
 * Gollum qui chuchote le bon chemin.
 * - cherche dans aliases
 * - cherche dans services
 * - sinon tente un chemin brut relatif au root
 */
export declare function resolveGollumPath(name: string, opts?: GollumOptions): string | null;
export {};
