# A11Host / Qflush Status

Etat actuel de l'integration outillee A11, apres unification du module A11Host.

## Surfaces backend disponibles

- `GET /api/a11host/status`
- `GET /api/a11/capabilities`
- `GET /api/v1/vs/status`
- `GET /api/v1/vs/capabilities`
- `GET /api/qflush/status`

Les routes `A11Host` sont maintenant montees derriere `verifyJWT`.

## Modes supportes

### Headless

Mode actif quand aucun bridge VSIX n'est connecte.

Capacites actuellement utilisables:

- `GetWorkspaceRoot`
- `DeleteFile`
- `RenameFile`
- `ExecuteShell`
- `BuildSolution`

Limites:

- pas d'acces editeur fin
- pas de document actif
- pas de selection courante
- pas de `GotoLine`
- pas de `OpenFile`
- pas de `GetOpenDocuments`

### VSIX / Visual Studio connecte

Quand le bridge A11Host est connecte, les appels privilegient les methodes du bridge.

Capacites ciblees:

- lecture du document actif
- lecture de la selection
- ouverture de fichier
- navigation ligne
- insertion / remplacement
- informations solution/projets
- documents ouverts

## Outils agent disponibles

Outils VS/A11Host actuellement exposes dans `tools-manifest.cjs` et `tools-dispatcher.cjs`:

- `vs_status`
- `vs_workspace_root`
- `vs_compilation_errors`
- `vs_project_structure`
- `vs_solution_info`
- `vs_active_document`
- `vs_current_selection`
- `vs_open_file`
- `vs_goto_line`
- `vs_open_documents`
- `vs_execute_shell`
- `vs_build_solution`

Notes:

- `vs_execute_shell` reutilise une whitelist safe cote agent
- `POST /api/v1/vs/execute-shell` reutilise la meme whitelist cote HTTP/backend
- si une capacite n'est pas disponible en mode courant, l'outil renvoie `ok: false` avec les `capabilities`

## Qflush

Qflush est deja supervise et expose un statut via:

- `GET /api/qflush/status`

Le backend remonte notamment:

- disponibilite du superviseur
- erreurs d'initialisation
- etat des processus supervises

## Source de verite

Le point d'entree unique A11Host est:

- `apps/server/a11host.cjs`

Il re-exporte:

- `apps/server/routes/a11host.cjs`

Ce module est partage par:

- `server.cjs`
- `src/a11host-bridge.cjs`
- `src/a11/tools-dispatcher.cjs`

## Prochaines etapes recommandees

1. Ajouter d'autres tools reellement utilitaires:
   `vs_active_document`, `vs_current_selection`, `vs_project_structure`, `vs_compilation_errors`
2. Mettre un garde-fou supplementaire sur la route HTTP `POST /api/v1/vs/execute-shell`
3. Brancher les capacites A11Host dans l'UI ou dans un panneau admin/debug
4. Documenter explicitement ce qui depend d'un host VSIX local vs ce qui fonctionne sur Railway
