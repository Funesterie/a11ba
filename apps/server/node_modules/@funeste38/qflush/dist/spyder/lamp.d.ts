export interface PathHint {
    from: string;
    to: string;
    maxDepth?: number;
}
export interface LampRoute {
    ok: boolean;
    steps: string[];
    reason?: string;
}
/**
 * Demande à la toile Spyder un chemin "éclairé" entre deux nœuds.
 * Ici on passe par un cri dans la corne → qui peut invoquer qflush spyder route.
 */
export declare function lightRoute(hint: PathHint): Promise<LampRoute>;
