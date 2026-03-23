export type SecretMatch = {
    file: string;
    pattern: string;
    match: string;
    index: number;
    line: number;
    snippet: string;
};
/**
 * Scanne un fichier pour les secrets et retourne les correspondances.
 * - filePath: chemin absolu ou relatif vers le fichier texte à scanner.
 */
export declare function scanFileForSecrets(filePath: string): SecretMatch[];
