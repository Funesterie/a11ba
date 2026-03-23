require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");
const child_process = require("child_process");

// -------------------------------------------
// DEV_MODE doit être défini avant toute utilisation
// -------------------------------------------
const DEV_MODE = true;
console.log("[Cerbère] !!! DEV MODE FORCÉ À TRUE !!!");

// Ollama backend config (env or default)
const OLLAMA_HOST = process.env.OLLAMA_HOST || "127.0.0.1";
const OLLAMA_PORT = process.env.OLLAMA_PORT || "11434";
const OLLAMA_BASE = `http://${OLLAMA_HOST}:${OLLAMA_PORT}`;

// Import A-11 agent prompts
const {
  A11_AGENT_SYSTEM_PROMPT,
  A11_AGENT_DEV_PROMPT,
} = require("./lib/a11Agent.js");

/// IMPORTANT: on utilise TOOL_IMPL comme “catalogue”
const { TOOL_IMPL } = require("./src/a11/tools-dispatcher.cjs");

const fsp = require("fs").promises;

const DATA_ROOT = process.env.A11_DATA_ROOT || "D:/A12";
const LTM_DIR = path.join(DATA_ROOT, "a11_memory", "long_term");
const ARCHIVE_DIR = path.join(DATA_ROOT, "a11_memory", "archives");
const BOOT_MEMO_PATH = path.join(DATA_ROOT, "a11_memory", "boot_memo.txt");
const MODULES_ROOT = process.env.A11_MODULES_ROOT || path.join(DATA_ROOT, "modules");

const router = express.Router();
router.use(express.json({ limit: "2mb" }));
router.use(cors());

// ─────────────────────────────────────────────────────────────
// Configuration globale
// ─────────────────────────────────────────────────────────────
const PORT = process.env.CERBERE_PORT || 4545;

// -------------------------------------------
// SECTION 1.3 — ANSI COLORS (Debug mode)
// -------------------------------------------
const COLOR = {
  reset: "\x1b[0m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m", // ✅ corrigé (t’avais un ] en trop)
};

function logStrategist(msg) {
  if (DEV_MODE) console.log(COLOR.blue + msg + COLOR.reset);
  else console.log(msg);
}
function logThinker(msg) {
  if (DEV_MODE) console.log(COLOR.yellow + msg + COLOR.reset);
  else console.log(msg);
}
function logMaker(msg) {
  if (DEV_MODE) console.log(COLOR.green + msg + COLOR.reset);
  else console.log(msg);
}
function logPipeline(msg) {
  if (DEV_MODE) console.log(COLOR.red + msg + COLOR.reset);
  else console.log(msg);
}
function logTool(msg) {
  if (DEV_MODE) console.log(COLOR.cyan + msg + COLOR.reset);
  else console.log(msg);
}
function logInfo(msg) {
  if (DEV_MODE) console.log(COLOR.magenta + msg + COLOR.reset);
  else console.log(msg);
}
function logError(msg) {
  if (DEV_MODE) console.error(COLOR.red + msg + COLOR.reset);
  else console.error(msg);
}
function logWarn(msg) {
  if (DEV_MODE) console.warn(COLOR.yellow + msg + COLOR.reset);
  else console.warn(msg);
}

// Workspace : dossier dans lequel A-11 a le droit d’écrire
const DEFAULT_WORKSPACE = "D:\\A12";
let WORKSPACE_ROOT = path.resolve(process.env.A11_WORKSPACE_ROOT || DEFAULT_WORKSPACE);
console.log("[Cerbère] Workspace root:", WORKSPACE_ROOT);

// ========================================================================
//    SECTION 2 — BACKENDS & MODEL SELECTION
// ========================================================================
const BACKENDS = {
  llama_local: "http://127.0.0.1:8000",
  ollama: OLLAMA_BASE,
  openai: "https://api.openai.com/v1",
  openai_local: "http://127.0.0.1:5001/v1",
};

logInfo("[Cerbère] Backends configurés: " + JSON.stringify(BACKENDS));

// expose simple stats for frontend dev checks
router.get(["/api/stats", "/api/llm/stats"], (req, res) => {
  res.json({
    service: "cerbere-dev-engine",
    version: "2.0.0",
    mode: DEV_MODE ? "developer" : "production",
    backends: BACKENDS,
    features: ["dev_engine", "nossen_protocol", "multi_backend_routing", "smart_prompting"],
  });
});
console.log("[Cerbère] Registered debug stats routes: /api/stats, /api/llm/stats");

// -------------------------------------------
// 2.2 — STRATEGISTE 64K (Ollama)
// -------------------------------------------
const STRATEGIST_BACKEND = {
  url: `${OLLAMA_BASE}/api/generate`,
  model: process.env.CERBERE_STRATEGIST_MODEL || "llama32-64k",
  options: {
    num_ctx: 64000,
    temperature: 0.2,
    top_p: 0.9,
  },
};

logStrategist("[Cerbère] Strategist 64K initialisé");

// -------------------------------------------
// 2.3 — SAFE BACKEND SELECTOR
// -------------------------------------------
function selectBackend(model) {
  const m = (model || "").toLowerCase();
  if (m.startsWith("gpt") || m.includes("openai")) return BACKENDS.openai;
  if (m.includes("openai_local")) return BACKENDS.openai_local;
  if (m.includes("ollama") || m.includes("olloma")) return BACKENDS.ollama;
  return BACKENDS.llama_local;
}

// -------------------------------------------
// 2.4 — Extract last user message
// -------------------------------------------
function extractUserPrompt(messages = []) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return (lastUser?.content || "").toString();
}

// ========================================================================
//   SECTION 3 — STRATEGIST / THINKER / MAKER / PIPELINE
// ========================================================================
async function callStrategist(userPrompt) {
  logStrategist("[Cerbère][STRATÉGISTE] Analyse & planification (Ollama 64K)");

  const body = {
    model: STRATEGIST_BACKEND.model,
    prompt: userPrompt,
    options: STRATEGIST_BACKEND.options,
  };

  try {
    const resp = await fetch(STRATEGIST_BACKEND.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    const text = data?.response || data?.text || JSON.stringify(data);
    return String(text).trim();
  } catch (err) {
    logStrategist("[Cerbère][STRATÉGISTE] ERREUR : " + err.message);
    return "ERREUR_STRATEGISTE";
  }
}

async function callThinker(prompt) {
  logThinker("[Cerbère][THINKER] GPT-4.1 engagé pour analyse");

  const backendURL = BACKENDS.openai.replace(/\/$/, "") + "/chat/completions";
  const body = { model: "gpt-4.1", messages: [{ role: "user", content: prompt }] };

  try {
    const resp = await fetch(backendURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content || "[Thinker: Pas de sortie]";
    return String(text).trim();
  } catch (err) {
    logThinker("[Cerbère][THINKER] ERREUR : " + err.message);
    return "ERREUR_THINKER";
  }
}

async function callMaker(input) {
  logMaker("[Cerbère][MAKER] LLaMA engagé pour exécution");

  const backendURL = BACKENDS.llama_local.replace(/\/$/, "") + "/v1/chat/completions";
  const messages = Array.isArray(input) ? input : [{ role: "user", content: input }];

  const body = { model: "llama3.2:latest", messages };

  try {
    const resp = await fetch(backendURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content || "[Maker: Pas de sortie]";
    return String(text).trim();
  } catch (err) {
    logMaker("[Cerbère][MAKER] ERREUR : " + err.message);
    return "ERREUR_MAKER";
  }
}

async function cerberePipeline(prompt) {
  logPipeline("🚀 [Cerbère] PIPELINE 3-TÊTES activé");

  const plan = await callStrategist(prompt);
  const thinker = await callThinker(`Analyse et améliore ce plan :\n${plan}`);
  const maker = await callMaker(
    `Voici un plan validé :\n${thinker}\n\nÉcris maintenant le résultat final complet, sans commentaire technique.`
  );

  return { plan, thinker, maker };
}

// ========================================================================
//   SECTION 4 — TOOLS A-11 (Fichiers, Web, QFlush, Actions)
// ========================================================================

// 4.1 — SAFE PATH (pas de ../ hack)
function resolveSafePath(relPath) {
  if (!relPath || typeof relPath !== "string") throw new Error("resolveSafePath: chemin invalide");
  const full = path.resolve(WORKSPACE_ROOT, relPath);
  if (!full.startsWith(WORKSPACE_ROOT)) throw new Error(`Tentative de sortie de la racine : ${relPath}`);
  return full;
}

// 4.2 — BACKUP SYSTEM (pour UNDO)
const BACKUP_DIR = path.join(WORKSPACE_ROOT, ".a11_backups");
function ensureBackupDir() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
function makeBackup(relPath) {
  try {
    const fullPath = resolveSafePath(relPath);
    if (!fs.existsSync(fullPath)) return;
    ensureBackupDir();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = relPath.replace(/[\\/]/g, "__") + "__" + stamp;
    const backupPath = path.join(BACKUP_DIR, backupName);
    fs.copyFileSync(fullPath, backupPath);
    logTool(`Backup créé : ${backupName}`);
    return backupPath;
  } catch (err) {
    logTool("Backup error: " + err.message);
  }
}
function getLastBackup(relPath) {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const prefix = relPath.replace(/[\\/]/g, "__") + "__";
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith(prefix));
  if (!files.length) return null;
  files.sort();
  return path.join(BACKUP_DIR, files[files.length - 1]);
}

// 4.3 — FILE OPERATIONS
function handleWriteFile(msg) {
  const full = resolveSafePath(msg.path);
  try {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, msg.content ?? "", msg.encoding || "utf8");
    const stats = fs.statSync(full);
    logTool("[write_file] " + full);
    return { ok: true, path: full, bytes: stats.size };
  } catch (err) {
    logTool("[write_file][ERROR] " + full + " : " + err.message);
    return { ok: false, error: err.message, path: full, code: err.code || null };
  }
}
function handleAppendFile(msg) {
  const full = resolveSafePath(msg.path);
  makeBackup(msg.path);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.appendFileSync(full, msg.content ?? "", msg.encoding || "utf8");
  logTool("[append_file] " + full);
  return { ok: true, path: full };
}
function handleMkdir(msg) {
  const full = resolveSafePath(msg.path);
  fs.mkdirSync(full, { recursive: true });
  logTool("[mkdir] " + full);
  return { ok: true, path: full };
}
function handleReadFile(msg) {
  const full = resolveSafePath(msg.path);
  if (!fs.existsSync(full)) return { ok: false, error: "File not found" };
  const data = fs.readFileSync(full, "utf8");
  logTool("[read_file] " + full);
  return { ok: true, path: full, content: data };
}
function handleListDir(msg) {
  const full = resolveSafePath(msg.path);
  if (!fs.existsSync(full)) return { ok: false, error: "Dir not found" };
  const items = fs.readdirSync(full, { withFileTypes: true }).map((d) => ({
    name: d.name,
    type: d.isDirectory() ? "dir" : "file",
  }));
  logTool("[list_dir] " + full);
  return { ok: true, path: full, items };
}
function handleDeleteFile(msg) {
  const full = resolveSafePath(msg.path);
  makeBackup(msg.path);
  fs.rmSync(full, { recursive: true, force: true });
  logTool("[delete_file] " + full);
  return { ok: true };
}
function handleRename(msg) {
  const from = resolveSafePath(msg.from);
  const to = resolveSafePath(msg.to);
  makeBackup(msg.from);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  logTool(`[rename] ${from} → ${to}`);
  return { ok: true };
}
function handleCopy(msg) {
  const from = resolveSafePath(msg.from);
  const to = resolveSafePath(msg.to);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
  logTool(`[copy] ${from} → ${to}`);
  return { ok: true };
}
function handleMove(msg) {
  const res = handleCopy(msg);
  handleDeleteFile({ path: msg.from });
  return res;
}

// 4.4 — APPLY PATCH (search → replace)
function handleApplyPatch(msg) {
  const full = resolveSafePath(msg.path);
  if (!fs.existsSync(full)) return { ok: false, error: "File not found" };
  const src = fs.readFileSync(full, "utf8");
  const search = msg.patch?.search;
  const replace = msg.patch?.replace;
  if (!search || replace === undefined) return { ok: false, error: "Invalid patch" };
  if (!src.includes(search)) return { ok: false, error: "Search term not found" };
  makeBackup(msg.path);
  const output = src.replace(search, replace);
  fs.writeFileSync(full, output, "utf8");
  logTool("[apply_patch] " + full);
  return { ok: true };
}

// 4.5 — EXECUTE SHELL COMMAND
function handleExec(msg) {
  try {
    const out = child_process
      .execSync(msg.command, { cwd: WORKSPACE_ROOT, stdio: ["ignore", "pipe", "pipe"] })
      .toString();
    logTool("[exec] " + msg.command);
    return { ok: true, output: out };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// 4.6 — UNDO
function handleUndo(msg) {
  const backup = getLastBackup(msg.path);
  if (!backup) return { ok: false, error: "No backup found" };
  const full = resolveSafePath(msg.path);
  fs.copyFileSync(backup, full);
  logTool("[undo_last] Restauré depuis " + backup);
  return { ok: true };
}

// ========================================================================
//   SECTION 5 — TOOL REGISTRY (✅ getTools implémenté)
// ========================================================================
async function loadModulesCatalog(modulesRoot = MODULES_ROOT) {
  const registry = [];
  try {
    const entries = await fsp.readdir(modulesRoot, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const modDir = path.join(modulesRoot, ent.name);
      const jsonPath = path.join(modDir, "module.json");
      if (!fs.existsSync(jsonPath)) continue;
      try {
        const raw = await fsp.readFile(jsonPath, "utf8");
        const meta = JSON.parse(raw);
        const name = (meta.name || meta.tool || meta.id || ent.name || "").toString();
        if (!name) continue;
        // Autorisation stricte
        if (!(meta.enabled === true || MODULES_WHITELIST.includes(name))) continue;
        const description = (meta.description || meta.desc || meta.summary || "").toString() || "module tool";
        const schema =
          meta.schema ||
          meta.input_schema ||
          meta.inputSchema ||
          meta.inputs ||
          { type: "object", additionalProperties: true };
        registry.push({ name, description, schema, _moduleDir: modDir });
      } catch (e) {
        logWarn(`[Cerbère] module.json invalide: ${jsonPath} (${e.message})`);
      }
    }
  } catch (e) {
    logWarn(`[Cerbère] Impossible de lire modulesRoot=${modulesRoot} (${e.message})`);
  }
  registry.sort((a, b) => a.name.localeCompare(b.name));
  return registry;
}

async function getTools({ workspaceRoot } = {}) {
  // Source de vérité exécution: TOOL_IMPL
  const impl = TOOL_IMPL || {};

  // Catalogue depuis module.json
  const dynamicRegistry = await loadModulesCatalog(MODULES_ROOT);

  // Fusion: si un module existe mais pas d’impl, on le tag (sinon agent va l’appeler et ça va fail)
  const implNames = new Set(Object.keys(impl));
  const registry = dynamicRegistry.map(t => ({
    ...t,
    description: t.description + (implNames.has(t.name) ? "" : " [NO_IMPL_IN_ROUTER]")
  }));

  // Ajoute aussi les tools "impl-only" pas décrites en module.json
  for (const name of Object.keys(impl).sort()) {
    if (!registry.find(r => r.name === name)) {
      registry.push({
        name,
        description: "tool",
        schema: { type: "object", additionalProperties: true }
      });
    }
  }

  return { TOOL_IMPL: impl, registry };
}

async function runDynamicModuleTool(toolName, args) {
  const modDir = path.join(MODULES_ROOT, toolName);
  const jsonPath = path.join(modDir, "module.json");
  const entry = path.join(modDir, "index.js");
  if (!fs.existsSync(entry) || !fs.existsSync(jsonPath)) {
    return { ok: false, error: `[NO_IMPL] Module ${toolName} not found or missing module.json` };
  }
  try {
    const meta = JSON.parse(await fsp.readFile(jsonPath, "utf8"));
    if (!(meta.enabled === true || MODULES_WHITELIST.includes(toolName))) {
      return { ok: false, error: `[MODULE_DISABLED] Module ${toolName} is not enabled or whitelisted` };
    }
    delete require.cache[require.resolve(entry)];
    const mod = require(entry);
    const fn = typeof mod === "function" ? mod : mod.run;
    if (typeof fn !== "function") {
      return { ok: false, error: `[NO_IMPL] Module ${toolName} does not export a function` };
    }
    const result = await fn(args || {});
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: `[MODULE_ERROR] ${toolName}: ${e.message}` };
  }
}

// --- PATCH: Anti-placeholder/anti-fake download_file enforcement ---
function isPlaceholderUrl(url = "") {
  return (
    /(^https?:\/\/)?(www\.)?(example\.com|example\.org|example\.net)\b/i.test(url) ||
    /placeholder|dummy|fake/i.test(url)
  );
}
function isUrlProven(url, toolResults = []) {
  const hay = JSON.stringify(toolResults || []);
  return hay.includes(url);
}
function sanitizeActions(envelope, toolResults) {
  if (!envelope?.actions?.length) return envelope;
  const before = envelope.actions.length;

  envelope.actions = envelope.actions.filter((a) => {
    const name = a.name || a.action;
    if (name !== "download_file") return true;
    const url = a.arguments?.url || a.input?.url || "";
    if (isPlaceholderUrl(url)) {
      logWarn `[Cerbère] Action download_file supprimée (placeholder URL): ${url}`;
      return false;
    }
    if (!isUrlProven(url, toolResults)) {
      logWarn `[Cerbère] Action download_file supprimée (URL non prouvée): ${url}`;
      return false;
    }
    return true;
  });

  if (envelope.actions.length !== before) {
    logWarn(`[Cerbère] ${before - envelope.actions.length} action(s) download_file supprimée(s).`);
  }
  return envelope;
}

// --- Policy: refuse actions not explicitly requested by user ---
function actionAllowedByUser(userPrompt, actName) {
  const p = (userPrompt || "").toLowerCase();
  if (actName === "generate_pdf") return p.includes("pdf");
  if (actName === "download_file") return p.includes("télécharge") || p.includes("telecharge") || p.includes("download");
  if (actName === "websearch" || actName === "web_search") return p.includes("cherche") || p.includes("recherche") || p.includes("search");
  return true;
}

function assertDataOnly(toolName, out) {
  if (out && typeof out === "object") {
    const forbidden = ["mode", "version", "actions", "question", "choices", "answer"];
    for (const k of forbidden) {
      if (k in out) {
        throw new Error(`TOOL_CONTRACT_VIOLATION:${toolName}: key "${k}" is forbidden in tool output`);
      }
    }
  }
  return out;
}

async function runEnvelopeActionsWithPolicy(envelope, userPrompt, toolResults = []) {
  envelope = sanitizeActions(envelope, toolResults);

  const actions = envelope.actions || [];
  const results = [];

  for (const a of actions) {
    const actName = getActionName(a) || "action";
    const args = a.arguments || a.input || {};

    if (!actionAllowedByUser(userPrompt, actName)) {
      results.push({ tool: actName, arguments: args, result: { ok: false, error: "Action not requested by user" } });
      continue;
    }

    logTool(`[envelope] → ${actName}`);
    let res = await handleDevAction({ action: actName, ...args });
    try {
      res = assertDataOnly(actName, res);
    } catch (e) {
      logError(`[Cerbère][TOOL_CONTRACT_VIOLATION] ${e.message}`);
      res = { ok: false, error: e.message };
    }
    results.push({ tool: actName, arguments: args, result: res });
  }

  return results;
}

// ========================================================================
//   SECTION 7 — ENDPOINT PRINCIPAL /v1/chat/completions (✅ UN SEUL)
// ========================================================================
router.post("/v1/chat/completions", async (req, res) => {
  const body = req.body || {};
  const model = body.model || "llama3.2:latest";
  const messages = body.messages || [];
  const stream = body.stream === true;

  const head = (body.cerbereHead || "maker").toLowerCase();
  const userPrompt = extractUserPrompt(messages || []);

  logInfo(`[Cerbère] /v1/chat/completions head=${head} | prompt="${userPrompt}"`);

  // Gating DEV_ENGINE
  const wantsDev = /\[DEV_ENGINE\]/i.test(userPrompt) || body.dev_engine === true;

  // tools catalog
  const { registry } = await getTools({ workspaceRoot: WORKSPACE_ROOT });
  const catalog = toolsCatalogText(registry);

  try {
    // 1) STRATEGIST
    if (head === "strategist") {
      const out = await callStrategist(userPrompt);
      return res.json({
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: out } }],
        cerbere: { mode: "strategist", head, prompt: userPrompt },
      });
    }

    // 2) THINKER
    if (head === "thinker") {
      const out = await callThinker(userPrompt);
      return res.json({
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: out } }],
        cerbere: { mode: "thinker", head, prompt: userPrompt },
      });
    }

    // 3) PIPELINE
    if (head === "pipeline") {
      const out = await cerberePipeline(userPrompt);
      const finalText = out?.maker || JSON.stringify(out, null, 2);
      return res.json({
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: finalText } }],
        cerbere: { mode: "pipeline", head, plan: out.plan, thinker: out.thinker },
      });
    }

    // 4) MAKER + DEV ENGINE loop
    const backendUrl = selectBackend(model).replace(/\/$/, "") + "/v1/chat/completions";

    let toolResults = [];
    let loopCount = 0;

    let lastData = null;
    let lastRaw = "";

    // si on n’est pas en dev engine, un seul call upstream “normal”
    if (!wantsDev) {
      const upstreamBody = { ...body, model, messages, stream };
      const upstreamRes = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(upstreamBody),
      });

      if (!upstreamRes.ok) {
        const errText = await upstreamRes.text();
        logError(`[Cerbère] Upstream error ${upstreamRes.status} from ${backendUrl}: ${errText}`);
        return res.status(upstreamRes.status).json({ error: "upstream_error", status: upstreamRes.status, detail: errText });
      }
      const data = await upstreamRes.json();
      return res.json(data);
    }

    // DEV ENGINE loop (max 5)
    while (loopCount < 5) {
      const injectedContext = `
${catalog}

[CONTEXT]
workspaceRoot=${WORKSPACE_ROOT}

[TOOL_RESULTS]
${toolResults.length ? JSON.stringify(toolResults, null, 2) : "[]"}

[USER_PROMPT]
${userPrompt}
`;

      const upstreamBody = {
        ...body,
        model,
        messages: [
          { role: "system", content: A11_AGENT_SYSTEM_PROMPT },
          { role: "system", content: A11_AGENT_DEV_PROMPT },
          { role: "user", content: injectedContext },
        ],
        stream,
      };

      const upstreamRes = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(upstreamBody),
      });

      if (!upstreamRes.ok) {
        const errText = await upstreamRes.text();
        logError(`[Cerbère] Upstream error ${upstreamRes.status} from ${backendUrl}: ${errText}`);
        return res.status(upstreamRes.status).json({ error: "upstream_error", status: upstreamRes.status, detail: errText });
      }

      lastData = await upstreamRes.json();
      lastRaw = lastData?.choices?.[0]?.message?.content || "";

      logInfo("[Cerbère] RAW LLM response (dev loop):");
      console.log(lastRaw);

      const cleaned = cleanJsonCandidate(lastRaw);

      let envelope = null;
      try {
        envelope = tryParseA11Envelope(cleaned) || parseEnvelope(cleaned);
      } catch (e) {
        logWarn("[DEV_ENGINE] No valid JSON envelope in LLM response: " + e.message);
        break;
      }

      // --- PATCH: Anti-hallucination URL enforcer ---
      if (isFindImagePrompt(userPrompt) && looksLikeAskingForUrl(envelope)) {
        logWarn("[Cerbère][ENFORCER] Maker hallucine une demande d'URL pour image, on force websearch.");
        envelope = {
          version: "a11-envelope-1",
          mode: "actions",
          actions: [
            { name: "websearch", arguments: { query: extractQuery(userPrompt) }, id: "sx-override-1" }
          ]
        };
      }

      // --- PATCH: Ignore need_user that just relays websearch result ---
      if (looksLikeAskingWebsearchResult(envelope) && toolResults.length > 0) {
        logWarn("[Cerbère][ENFORCER] Maker demande la réponse du tool websearch, on renvoie le résultat directement.");
        envelope = {
          version: "a11-envelope-1",
          mode: "final",
          result: toolResults[toolResults.length - 1]?.result || {}
        };
        break;
      }

      // si le modèle renvoie une réponse finale, on sort
      if (!envelope || envelope.mode === "final" || envelope.mode === "need_user") {
        break;
      }

      // actions → exécute + reprompt avec TOOL_RESULTS
      if (envelope.mode === "actions" && Array.isArray(envelope.actions) && envelope.actions.length > 0) {
        toolResults = await runEnvelopeActionsWithPolicy(envelope, userPrompt, toolResults);
        loopCount++;
        continue;
      }

      // sinon stop
      break;
    }

    const finalSummary =
      (await buildDevSummaryWithLLM({
        upstreamUrl: backendUrl,
        model,
        userPrompt,
        actionResults: toolResults,
      })) || summarizeActionsFallback(toolResults);

    return res.json({
      ...lastData,
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: finalSummary } }],
      cerbere: { mode: "maker-with-dev-engine", head, actions: toolResults },
    });
  } catch (err) {
    logError("[Cerbère] router_error: " + err.message);
    return res.status(502).json({ error: "router_error", message: err.message, detail: String(err) });
  }
});

// module.exports = router pour usage dans server.cjs ou ailleurs
module.exports = router;

// Ajoute la whitelist en haut du fichier
const MODULES_WHITELIST = [
  "generate_pdf",
  "zip",
  "unzip",
  // Ajoute ici les noms sûrs que tu veux autoriser
];

// Remplace la fonction handleDevAction par une version avec websearch normalisé
async function handleDevAction(msg = {}) {
  try {
    const action = (msg.action || msg.tool || "").toString().toLowerCase();
    switch (action) {
      case "write_file":
      case "writefile":
      case "write-file":
        return handleWriteFile(msg);
      case "append_file":
      case "appendfile":
      case "append-file":
        return handleAppendFile(msg);
      case "mkdir":
      case "make_dir":
      case "mkdirp":
        return handleMkdir(msg);
      case "read_file":
      case "readfile":
        return handleReadFile(msg);
      case "list_dir":
      case "ls":
      case "listdir":
        return handleListDir(msg);
      case "delete_file":
      case "rm":
      case "remove_file":
        return handleDeleteFile(msg);
      case "rename":
        return handleRename(msg);
      case "copy":
        return handleCopy(msg);
      case "move":
        return handleMove(msg);
      case "apply_patch":
      case "applypatch":
        return handleApplyPatch(msg);
      case "exec":
      case "execute":
      case "shell":
        return handleExec(msg);
      case "undo":
      case "restore":
        return handleUndo(msg);

      // wrappers around tool modules
      case "fs_read":
        return await fs_read(msg);
      case "fs_write":
        return await fs_write(msg);
      case "fs_list":
        return await fs_list(msg);
      case "websearch":
      case "web_search":
      case "websearch_tool": {
        const args = normalizeWebsearchArgs(msg);
        if (!args.query) return { ok: false, error: "MISSING_QUERY" };
        if (TOOL_IMPL && typeof TOOL_IMPL.websearch === "function") {
          return await TOOL_IMPL.websearch(args);
        }
        return { ok: false, error: "NO_WEBSERCH_IMPL" };
      }
      case "web_fetch":
      case "web-fetch":
      case "fetch":
        return await web_fetch(msg);
      case "qflush":
      case "run_qflush_flow":
      case "qflush_flow":
        return await runQflushFlow(msg);
      case "shell_exec":
      case "shell-exec":
        return await shell_exec(msg);

      default:
        // fallback: si TOOL_IMPL ne connaît pas, tente de charger un module dynamique
        if (MODULES_ROOT && fs.existsSync(path.join(MODULES_ROOT, action))) {
          return await runDynamicModuleTool(action, msg);
        }
        return { ok: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// Ajout : normalisation des arguments websearch
function normalizeWebsearchArgs(args = {}) {
  if (!args.query && args.q) args.query = args.q;
  return { query: String(args.query || "").trim() };
}

function toolsCatalogText(registry = []) {
  const lines = ["[TOOLS_CATALOG]"];
  for (const t of registry) {
    lines.push(`- ${t.name}: ${t.description || "no_desc"}`);
    lines.push(`  schema=${JSON.stringify(t.schema)}`);
  }
  return lines.join("\n");
}

function cleanJsonCandidate(text = "") {
  if (!text) return "";
  let s = String(text).trim();
  if (s.startsWith("```")) {
    const nl = s.indexOf("\n");
    if (nl !== -1) s = s.slice(nl + 1);
    if (s.endsWith("```")) s = s.slice(0, -3);
    s = s.trim();
  }
  const start = s.indexOf("{");
  if (start === -1) return "";
  let depth = 0;
  let inString = false;
  let prev = "";
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (c === '"' && prev !== "\\") inString = false;
    } else {
      if (c === '"') inString = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
    prev = c;
  }
  return s.slice(start);
}

function tryParseA11Envelope(raw) {
  if (!raw || typeof raw !== "string") return null;
  let obj = null;
  let trimmed = raw.trim();
  try {
    obj = JSON.parse(trimmed);
  } catch {
    // Tentative de réparation : ajoute une } si manquante
    if (!trimmed.endsWith("}")) {
      try {
        obj = JSON.parse(trimmed + "}");
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }

  if (obj && obj.version === "a11-envelope-1" && obj.mode === "actions" && Array.isArray(obj.actions)) return obj;

  if (obj && obj.version === "a11-action-1" && obj.action && typeof obj.action.tool === "string") {
    return {
      version: "a11-envelope-1",
      mode: "actions",
      actions: [
        { name: obj.action.tool, arguments: obj.action.input || {}, id: obj.action.id || "auto-1" },
      ],
    };
  }
  return null;
}

function parseEnvelope(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    logWarn(`[Cerbère] parseEnvelope JSON error (slice): ${e.message}`);
    return null;
  }
}

async function buildDevSummaryWithLLM({ upstreamUrl, model, userPrompt, actionResults, imageUrl }) {
  try {
    const imgBlock = imageUrl ? `\nVoici l'image générée :\n\n![image](${imageUrl})\n` : "";
    const messages = [
      {
        role: "system",
        content: "Tu es A-11. Résume ce que tu viens de faire. Pas de JSON, pas de code. Réponse claire uniquement.",
      },
      {
        role: "user",
        content:
          `Demande utilisateur :\n${userPrompt}\n\n` +
          `Actions exécutées :\n${JSON.stringify(actionResults, null, 2)}\n` +
          imgBlock,
      },
    ];
    const body = { model, messages, stream: false };
    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    logTool("[DevSummary] ERROR: " + err.message);
    return null;
  }
}

// --- PATCH: Anti-hallucination URL enforcer ---
function looksLikeAskingForUrl(envelope) {
  if (!envelope || envelope.mode !== "need_user") return false;
  const q = (envelope.question || "").toLowerCase();
  return q.includes("url") && q.includes("image");
}

function looksLikeAskingWebsearchResult(envelope) {
  if (!envelope || envelope.mode !== "need_user") return false;
  const q = (envelope.question || "").toLowerCase();
  return (
    q.includes("réponse de la recherche web") ||
    q.includes("websearch result") ||
    (q.includes("quelle est la réponse") && q.includes("recherche web"))
  );
}

function isFindImagePrompt(userPrompt) {
  const p = (userPrompt || "").toLowerCase();
  return (
    (p.includes("cherche") || p.includes("trouve") || p.includes("find")) &&
    p.includes("image")
  );
}

function extractQuery(userPrompt) {
  let p = userPrompt.replace(/\[DEV_ENGINE\]/gi, "").trim();
  const m = p.match(/(?:cherche|trouve|find)(.*)/i);
  if (m && m[1]) return m[1].trim();
  return p;
}

function getActionName(a) {
  return (a?.action || a?.tool || a?.name || "").toString();
}

