/**
 * A11Host API Routes - VS integration + Headless backend mode
 * - Avec VSIX : utilise le bridge A11HostApi.cs
 * - Sans VSIX : fallback sur un "headless host" (fs + shell) côté backend
 */

const path = require('node:path');
const fs = require('node:fs/promises');
const childProcess = require('node:child_process');
const util = require('node:util');

const execAsync = util.promisify(childProcess.exec);

// =========================
// BRIDGES & CONFIG
// =========================

// Bridge VSIX (injecté par la WebView)
let a11HostBridge = null;

// Config headless (peut être override depuis server.cjs)
let headlessConfig = {
  workspaceRoot: process.env.A11_WORKSPACE_ROOT || process.cwd(),
  buildCommand: process.env.A11_BUILD_COMMAND || null, // ex: "dotnet build" ou "npm run build"
  shellCwd: process.env.A11_SHELL_CWD || null
};

/**
 * Initialize A11Host bridge (called by VSIX when available)
 */
function setA11HostBridge(bridge) {
  a11HostBridge = bridge;
  console.log('[A11Host] Bridge initialized (VSIX mode)');
}

/**
 * Configure headless mode (optional, depuis server.cjs)
 */
function setHeadlessConfig(cfg = {}) {
  headlessConfig = {
    ...headlessConfig,
    ...cfg
  };
  console.log('[A11Host] Headless config updated:', headlessConfig);
}

// =========================
// HEADLESS HOST
// =========================

const headlessHost = {
  /**
   * Workspace root : en headless, c'est soit A11_WORKSPACE_ROOT soit process.cwd()
   */
  async GetWorkspaceRoot() {
    return headlessConfig.workspaceRoot || process.cwd();
  },

  /**
   * DeleteFile : suppression directe côté FS
   */
  async DeleteFile(absPath) {
    await fs.unlink(absPath);
    return true;
  },

  /**
   * RenameFile : renommage côté FS
   */
  async RenameFile(oldPath, newPath) {
    await fs.rename(oldPath, newPath);
    return true;
  },

  /**
   * ExecuteShell : exécution d'une commande dans le workspace
   */
  async ExecuteShell(command) {
    const cwd =
      headlessConfig.shellCwd ||
      headlessConfig.workspaceRoot ||
      process.cwd();

    const { stdout, stderr } = await execAsync(command, { cwd });
    return stdout + (stderr ? '\n' + stderr : '');
  },

  /**
   * BuildSolution : on exécute A11_BUILD_COMMAND si défini
   * (ex: "dotnet build", "npm run build", etc.)
   */
  async BuildSolution() {
    const buildCommand =
      headlessConfig.buildCommand ||
      process.env.A11_BUILD_COMMAND;

    if (!buildCommand) {
      throw new Error(
        'Headless BuildSolution: no A11_BUILD_COMMAND configured'
      );
    }

    const cwd =
      headlessConfig.shellCwd ||
      headlessConfig.workspaceRoot ||
      process.cwd();

    await execAsync(buildCommand, { cwd });
    return true;
  }

  // NOTE:
  // Les méthodes de type "éditeur" (InsertAtCursor, ReplaceSelection,
  // GetActiveDocument, etc.) ne sont pas implémentables proprement en
  // headless, donc on les laisse non définies ici.
};

// =========================
// CORE CALL DISPATCH
// =========================

/**
 * Call A11Host method with args
 * - Si VSIX est connecté → appelle le bridge
 * - Sinon → essaie d'utiliser le headlessHost
 */
async function callA11Host(methodName, ...args) {
  // 1) VSIX Bridge présent + méthode dispo → priorité
  if (
    a11HostBridge &&
    typeof a11HostBridge[methodName] === 'function'
  ) {
    try {
      const result = await a11HostBridge[methodName](...args);
      return result;
    } catch (err) {
      console.error(
        `[A11Host] Error calling VSIX ${methodName}:`,
        err.message
      );
      throw err;
    }
  }

  // 2) Sinon, fallback headless si la méthode existe
  if (typeof headlessHost[methodName] === 'function') {
    try {
      const result = await headlessHost[methodName](...args);
      console.log(
        `[A11Host] (headless) ${methodName}(${args
          .map(a => JSON.stringify(a))
          .join(', ')})`
      );
      return result;
    } catch (err) {
      console.error(
        `[A11Host] Error calling headless ${methodName}:`,
        err.message
      );
      throw err;
    }
  }

  // 3) Rien trouvé
  throw new Error(
    `A11Host method not available: ${methodName} (no VSIX and no headless implementation)`
  );
}

// =========================
// PATH VALIDATION
// =========================

/**
 * Validate path is within workspace
 */
function validatePath(targetPath, workspaceRoot) {
  const normalized = path.normalize(targetPath);
  const resolvedWorkspace = path.resolve(workspaceRoot);
  const resolvedPath = path.resolve(normalized);

  if (!resolvedPath.startsWith(resolvedWorkspace)) {
    throw new Error('Path outside workspace');
  }

  return resolvedPath;
}

// =========================
// ROUTES REGISTRATION
// =========================

function registerA11HostRoutes(router) {
  console.log('[Server] Registering A11Host routes (VSIX + headless)...');

  // ========== CODE ANALYSIS ENDPOINTS ========== ...existing code...
  // ...existing code...
  // ========== UTILITY ENDPOINTS ========== ...existing code...
  // ...existing code...
  console.log('[Server] ✓ A11Host routes registered (with headless fallback)');
}

module.exports = {
  registerA11HostRoutes,
  setA11HostBridge,
  callA11Host,
  setHeadlessConfig
};
