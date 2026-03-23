// tools-manifest.cjs

const path = require("node:path");

const WORKSPACE_ROOTS = [
  "D:\\A11",
  "D:\\A12"
];

const DEFAULT_WORKSPACE_ROOT = WORKSPACE_ROOTS[0];

const SAFE_DATA_ROOT = path.resolve(
  WORKSPACE_ROOTS[1] || WORKSPACE_ROOTS[0],
  "."
);

const TOOL_MANIFEST = {
  fs_search: {
    description: "Recherche de fichiers par nom ou motif dans le workspace.",
    dangerLevel: "medium",
    constraints: { roots: WORKSPACE_ROOTS },
    args: { pattern: "string (motif de recherche, ex: '*.pdf', 'rapport')", path: "chemin dossier (optionnel)" }
  },
  qflush_flow: {
    description: "Exécute un flow QFLUSH sur la machine locale.",
    dangerLevel: "medium",
    args: {
      flow: "string (nom du flow, ex: 'pdf_report_basic', 'web_to_pdf_report', 'encode_oc8')",
      payload: "object (paramètres pour le flow)"
    }
  },
  fs_read: {
    description: "Lire le contenu texte d’un fichier.",
    dangerLevel: "low",
    constraints: { roots: WORKSPACE_ROOTS },
    args: { path: "chemin absolu dans un workspace autorisé" }
  },
  fs_write: {
    description: "Écrire un fichier texte (création ou remplacement).",
    dangerLevel: "medium",
    constraints: { roots: WORKSPACE_ROOTS },
    args: { path: "chemin absolu", content: "string (contenu texte)", overwrite: "bool (par défaut false)" }
  },
  fs_list: {
    description: "Lister le contenu d’un dossier.",
    dangerLevel: "low",
    constraints: { roots: WORKSPACE_ROOTS },
    args: { path: "chemin dossier" }
  },
  fs_stat: {
    description: "Infos sur un fichier/dossier (taille, dates, type).",
    dangerLevel: "low",
    constraints: { roots: WORKSPACE_ROOTS },
    args: { path: "chemin absolu" }
  },
  fs_delete: {
    description: "Supprimer un fichier.",
    dangerLevel: "high",
    constraints: { roots: WORKSPACE_ROOTS, requireExplicitUserIntent: true },
    args: { path: "chemin absolu" }
  },
  fs_move: {
    description: "Déplacer/renommer un fichier ou dossier.",
    dangerLevel: "high",
    constraints: { roots: WORKSPACE_ROOTS },
    args: { from: "chemin source", to: "chemin destination" }
  },
  zip_create: {
    description: "Créer un .zip à partir d’un dossier ou d’une liste de fichiers.",
    dangerLevel: "medium",
    constraints: { roots: WORKSPACE_ROOTS },
    args: { inputPaths: "string[] (chemins à zipper)", outputPath: "chemin du zip" }
  },
  unzip_extract: {
    description: "Extraire un .zip.",
    dangerLevel: "medium",
    constraints: { roots: WORKSPACE_ROOTS },
    args: { zipPath: "chemin du zip", outputDir: "dossier cible" }
  },
  shell_exec: {
    description: "Exécuter une commande shell contrôlée (diagnostic / build / git safe).",
    dangerLevel: "high",
    constraints: {
      roots: WORKSPACE_ROOTS,
      allowListExamples: [
        "git status",
        "git diff",
        "npm test",
        "npm run build",
        "dotnet --info",
        "dotnet build"
      ]
    },
    args: { command: "string (doit matcher une whitelist côté backend)", cwd: "chemin de travail (optionnel, dans un workspace autorisé)" }
  },
  web_fetch: {
    description: "Fetches a web page (HTML/text) from allowed domains.",
    dangerLevel: "medium",
    constraints: {
      allowedDomainsExamples: [
        "duckduckgo.com",
        "wikipedia.org",
        "wikimedia.org",
        "unsplash.com",
        "pexels.com"
      ]
    },
    args: { url: "string" }
  },
  web_search: {
    description: "Recherche web simple (résultats texte + liens) pour l’agent A-11.",
    dangerLevel: "medium",
    args: {
      query: "string (requête de recherche)",
      limit: "number (facultatif, nombre max de résultats, ex: 5)"
    }
  },
  llm_analyze_text: {
    description: "Analyse ou résumé de texte via le backend LLM (réutilisation de Cerbère).",
    dangerLevel: "low",
    args: { text: "string", task: "string (ex: 'summary', 'bullet-points', 'explain', 'refactor')" }
  },
  vs_status: {
    description: "Vérifier si Visual Studio / A11Host est connecté, lister les méthodes dispos.",
    dangerLevel: "low",
    args: {}
  },
  vs_open_file: {
    description: "Ouvrir un fichier dans Visual Studio (si A11Host connecté).",
    dangerLevel: "medium",
    args: { path: "chemin absolu" }
  },
  vs_build_solution: {
    description: "Lancer un build solution dans Visual Studio.",
    dangerLevel: "medium",
    args: {}
  },
  generate_pdf: {
    description: "Génère un PDF à partir de sections/textes/images.",
    dangerLevel: "medium",
    args: { outputPath: "string", title: "string", sections: "array", author: "string", date: "string" }
  },
  generate_png: {
    description: "Génère une image PNG à partir de données ou texte.",
    dangerLevel: "medium",
    args: { outputPath: "string", text: "string", width: "number", height: "number" }
  },
  tts_basic: {
    description: "Synthèse vocale basique.",
    dangerLevel: "low",
    args: { text: "string", voice: "string", outputPath: "string" }
  },
  ocr_file: {
    description: "Reconnaissance de texte dans un fichier image ou PDF.",
    dangerLevel: "medium",
    args: { path: "string" }
  },
  zip: {
    description: "Crée une archive ZIP.",
    dangerLevel: "medium",
    args: { inputPaths: "array", outputPath: "string" }
  },
  unzip: {
    description: "Décompresse une archive ZIP.",
    dangerLevel: "medium",
    args: { zipPath: "string", outputDir: "string" }
  },
  vision_analyze: {
    description: "Analyse d'image (vision par ordinateur).",
    dangerLevel: "medium",
    args: { path: "string", task: "string" }
  },
  audio_info: {
    description: "Analyse des métadonnées audio.",
    dangerLevel: "low",
    args: { path: "string" }
  },
  video_tools: {
    description: "Outils de manipulation vidéo.",
    dangerLevel: "medium",
    args: { path: "string", action: "string" }
  },
  csv_tools: {
    description: "Outils de manipulation CSV.",
    dangerLevel: "low",
    args: { path: "string", action: "string" }
  },
  agent_log: {
    description: "Journalisation des actions de l'agent.",
    dangerLevel: "low",
    args: { message: "string", level: "string" }
  },
  download_file: {
    dangerLevel: "medium",
    description: "Télécharger un fichier depuis une URL dans le workspace.",
    constraints: { roots: WORKSPACE_ROOTS },
    args: { url: "string", outputPath: "chemin absolu" }
  },
  a11_env_snapshot: {
    dangerLevel: "low",
    description: "Retourne un snapshot JSON de l'environnement A-11 (tools, roots, qflush, cerbère, env safe)."
  },
  a11_debug_echo: {
    dangerLevel: "low",
    description: "Outil de debug qui renvoie textuellement les arguments pour inspection."
  },
  write_file: {
    description: "Écrire un fichier texte (mode assistant, chemin relatif ou absolu dans le workspace).",
    dangerLevel: "medium",
    constraints: { roots: WORKSPACE_ROOTS },
    args: {
      path: "string (chemin relatif ou absolu dans un workspace autorisé)",
      content: "string (contenu texte)",
      overwrite: "bool (par défaut false)"
    }
  },
  a11_memory_write: {
    description: "Stocke une valeur courte dans le KV store local d'A-11.",
    dangerLevel: "low",
    args: {
      key: "string (clé de mémo, ex: 'bonjour_bg')",
      value: "string (valeur associée)"
    }
  },
  a11_memory_read: {
    description: "Lit une valeur depuis le KV store local d'A-11.",
    dangerLevel: "low",
    args: {
      key: "string (clé de mémo à lire)"
    }
  }
};

module.exports = {
  TOOL_MANIFEST,
  WORKSPACE_ROOTS,
  DEFAULT_WORKSPACE_ROOT,
  SAFE_DATA_ROOT,
};
