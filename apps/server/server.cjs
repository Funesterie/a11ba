// --- .env first ---
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const fs = require('node:fs');
const dotenv = require('dotenv');

// A11Host (VSIX + headless)
const {
  registerA11HostRoutes,
  setHeadlessConfig
} = require('./a11host.cjs'); // adapte le chemin si besoin

// Prevent DeprecationWarning for util._extend by replacing it early with Object.assign
try {
  const coreUtil = require('node:util');
  if (coreUtil?._extend !== undefined) coreUtil._extend = Object.assign; 
} catch (error_) {
  console.warn('[A11] util bootstrap failed:', error_.message);
}

// Prefer server-local env (.env.local) for dev, fallback to repo root .env
const localEnvPath = path.resolve(__dirname, '.env.local');
const repoEnvPath = path.resolve(__dirname, '../../.env');
let envSource = null;
if (fs.existsSync(localEnvPath)) {
  console.log('[A11] Chargement des variables d\'environnement depuis', localEnvPath);
  dotenv.config({ path: localEnvPath });
  envSource = localEnvPath;
} else if (fs.existsSync(repoEnvPath)) {
  console.log('[A11] Chargement des variables d\'environnement depuis', repoEnvPath);
  dotenv.config({ path: repoEnvPath });
  envSource = repoEnvPath;
} else {
  console.log('[A11] Aucun fichier .env trouvé (cherche .env.local puis ../../.env)');
  envSource = 'ENVIRONMENT ONLY';
}

// DEBUG: log Nez env vars
console.log('[NEZ ENV] NEZ_TOKENS=', process.env.NEZ_TOKENS);
console.log('[NEZ ENV] NEZ_ADMIN_TOKEN=', process.env.NEZ_ADMIN_TOKEN);
console.log('[NEZ ENV] NEZ_ALLOWED_TOKEN=', process.env.NEZ_ALLOWED_TOKEN);

// Ensure runtime configuration defaults are set to avoid ReferenceErrors
const CTX_SIZE = Number(process.env.CTX_SIZE) || 8192;
const BATCH_SIZE = Number(process.env.BATCH_SIZE) || 4096;
const PARALLEL = Number(process.env.PARALLEL) || 8;

// Set remote qflush URL for production (allow env override)
process.env.QFLUSH_URL = process.env.QFLUSH_URL || process.env.QFLUSH_REMOTE_URL || 'https://qflush-production.up.railway.app';
process.env.QFLUSH_REMOTE_URL = process.env.QFLUSH_REMOTE_URL || process.env.QFLUSH_URL;

const qflushIntegration = require('./src/qflush-integration.cjs');
const { setupA11Supervisor, runQflushFlow } = qflushIntegration;

// -------------------

// --- Compilation automatique de openai.ts ---
const { execSync } = require('node:child_process');
const tsPath = path.resolve(__dirname, 'providers', 'openai.ts');
const jsPath = path.resolve(__dirname, 'providers', 'openai.js');
try {
  const tsMtime = fs.existsSync(tsPath) ? fs.statSync(tsPath).mtimeMs : 0;
  const jsMtime = fs.existsSync(jsPath) ? fs.statSync(jsPath).mtimeMs : 0;
  if (tsMtime > jsMtime || !fs.existsSync(jsPath)) {
    console.log('[A11] Compilation automatique de openai.ts...');
    execSync("npx tsc \"" + tsPath + "\" --outDir \"" + path.dirname(tsPath) + "\"");
    console.log('[A11] Compilation terminée.');
  }
} catch (e) {
  console.warn('[A11] Erreur compilation openai.ts:', e.message);
}
// -------------------

// Import all required modules at the top
const { spawn } = require('node:child_process');
const express = require('express');
const { Router } = require('express');
const { registerOpenAIRoutes } = require('./src/routes/llm-openai');
const cors = require('cors');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const crypto = require('node:crypto');
// OpenAI SDK (CommonJS)
let OpenAI;
try {
  OpenAI = require('openai');
} catch (error_) {
  console.warn('[A11] OpenAI SDK unavailable:', error_.message);
  OpenAI = null;
}

const openaiClient = OpenAI ? new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL || (process.env.UPSTREAM_ORIGIN || 'https://api.funesterie.me') + '/v1',
  apiKey: process.env.OPENAI_API_KEY || 'dummy',
  defaultHeaders: {
    'X-NEZ-TOKEN': process.env.NEZ_ALLOWED_TOKEN || process.env.NEZ_TOKENS || 'nez:a11-client-funesterie-pro'
  }
}) : null;
const multer = require('multer');
const open = require('open');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { nezAuth, getNezAccessLog, TOKENS, MODE, registerIssuedToken } = require('./src/middleware/nezAuth');

const BASE = path.resolve(__dirname);
const LLAMA_DIR = path.join(BASE, 'llama.cpp');
const BIN_DIR_REL = path.join('build', 'bin', 'Release');
const BIN_DIR_FALLBACK = path.join('build', 'bin');

// qflush supervisor integration: detect if available (try module first, then local exe)
let QFLUSH_AVAILABLE = false;
let QFLUSH_MODULE = null;
let QFLUSH_PATH = null;
try {
  // Avoid requiring 'qflush' at top-level because the package may auto-run its pipeline on require()
  // Instead detect presence of the package and defer requiring it to the qflush-integration helper
  const qflushModuleDir = path.join(BASE, 'node_modules', '@funeste38', 'qflush');
  if (fs.existsSync(qflushModuleDir)) {
    QFLUSH_AVAILABLE = true;
    console.log('[QFLUSH] qflush module found in node_modules; will initialize via integration helper');
  } else {
    // fallback: check for a local qflush executable in project folders
    const qflushCandidates = [
      path.join(BASE, '.qflush', 'qflush.exe'),
      path.join(BASE, 'qflush', 'qflush.exe'),
      path.join(BASE, 'bin', 'qflush.exe')
    ];
    for (const candidate of qflushCandidates) {
      try {
        if (fs.existsSync(candidate)) {
          QFLUSH_PATH = candidate;
          QFLUSH_AVAILABLE = true;
          console.log('[QFLUSH] Found local qflush executable at', candidate);
          break;
        }
      } catch (error_) {
        console.debug('[QFLUSH] candidate check failed:', error_.message);
      }
    }
    if (!QFLUSH_AVAILABLE) {
      console.log('[QFLUSH] qflush integration not available. Skipping.');
    }
  }
} catch (e) {
  console.log('[QFLUSH] qflush detection failed:', e?.message);
}

// export for other modules to check
globalThis.__QFLUSH_AVAILABLE = QFLUSH_AVAILABLE;
globalThis.__QFLUSH_MODULE = QFLUSH_MODULE;
globalThis.__QFLUSH_PATH = QFLUSH_PATH;

// Initialize qflush supervisor if available
if (QFLUSH_AVAILABLE) {
  try {
    setupA11Supervisor().then((supervisor) => {
      if (supervisor) {
        console.log('[Supervisor] A11 supervisor initialized');
        globalThis.__A11_SUPERVISOR = supervisor;
        globalThis.__A11_QFLUSH_SUPERVISOR = supervisor;
        // Optionally start managed processes
        // Note: On Railway (cloud), local processes won't start
      }
    }).catch((e) => {
      console.warn('[Supervisor] Setup failed:', e.message);
    });
  } catch (e) {
    console.warn('[Supervisor] Load failed:', e.message);
  }
}

// --- Mémoire persistante A-11 (conversations) ---
const fsMem = require('node:fs');
const pathMem = require('node:path');

const A11_WORKSPACE_ROOT =
  process.env.A11_WORKSPACE_ROOT ||
  pathMem.resolve(__dirname, '..', '..'); // ex: D:\A11

const A11_MEMORY_ROOT = pathMem.join(A11_WORKSPACE_ROOT, 'a11_memory');
const A11_CONV_DIR = pathMem.join(A11_MEMORY_ROOT, 'conversations');

function ensureConvDir() {
  try {
    if (!fsMem.existsSync(A11_CONV_DIR)) {
      fsMem.mkdirSync(A11_CONV_DIR, { recursive: true });
    }
  } catch (e) {
    console.warn('[A11][memory] mkdir failed:', e?.message);
  }
}

function appendConversationLog(entry) {
  try {
    ensureConvDir();
    const ts = new Date();
    const day = ts.toISOString().slice(0, 10).replaceAll('-', '');
    const file = pathMem.join(A11_CONV_DIR, `${day}.jsonl`);
    const payload = { ts: ts.toISOString(), ...entry };
    fsMem.appendFileSync(file, JSON.stringify(payload) + '\n', 'utf8');
  } catch (e) {
    console.warn('[A11][memory] append failed:', e?.message);
  }
}
// --- Fin bloc mémoire persistante ---

// --- Mémoire persistante A-11 : MEMOS JSON ---
const A11_MEMO_DIR    = pathMem.join(A11_MEMORY_ROOT, 'memos');
const A11_MEMO_INDEX  = pathMem.join(A11_MEMO_DIR, 'memo_index.jsonl');

function ensureMemoDir() {
  try {
    fsMem.mkdirSync(A11_MEMO_DIR, { recursive: true });
  } catch (e) {
    console.warn('[A11][memo] mkdir failed:', e?.message);
  }
}

function saveMemo(type, data) {
  try {
    ensureMemoDir();
    const ts = new Date().toISOString();
    const id = `memo_${type}_${Date.now()}`;

    const memoFile = pathMem.join(A11_MEMO_DIR, `${id}.json`);
    const entry = { id, ts, type, data };

    // Fichier mémo complet
    fsMem.writeFileSync(memoFile, JSON.stringify(entry, null, 2), 'utf8');

    // Index JSONL (append)
    fsMem.appendFileSync(A11_MEMO_INDEX, JSON.stringify(entry) + '\n', 'utf8');

    return entry;
  } catch (e) {
    console.warn('[A11][memo] save failed:', e?.message);
    return null;
  }
}

function loadAllMemos() {
  try {
    ensureMemoDir();
    if (!fsMem.existsSync(A11_MEMO_INDEX)) return [];

    const raw = fsMem.readFileSync(A11_MEMO_INDEX, 'utf8');
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

    const entries = [];
    for (const l of lines) {
      try { entries.push(JSON.parse(l)); } catch {}
    }

    entries.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));

    return entries;
  } catch (e) {
    console.warn('[A11][memo] load failed:', e?.message);
    return [];
  }
}
// --- FIN MEMOS JSON ---

// === Upload (OCR) - use memory storage to avoid disk writes ===
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});
const { WebSocketServer } = require('ws');

const app = express();
const router = Router();

// Racine de travail (doit pointer sur D:\A12 chez toi en .env)
const WORKSPACE_ROOT = process.env.A11_WORKSPACE_ROOT || path.resolve(__dirname, '..', '..');

// Exposer le workspace en lecture seule sous /files
app.use('/files', express.static(WORKSPACE_ROOT, {
  dotfiles: 'ignore',
  maxAge: '1d'
}));
console.log('[A11] Static /files ->', WORKSPACE_ROOT);

// Config headless A11Host (active même sans Visual Studio/VSIX)
setHeadlessConfig({
  // Racine du workspace : adapte si besoin (ex: D:\A11, D:\A12, etc.)
  workspaceRoot: process.env.A11_WORKSPACE_ROOT || path.resolve(__dirname, '..', '..'),
  // Commande de build par défaut en mode headless
  // (tu peux mettre "dotnet build", "npm run build", etc.)
  buildCommand: process.env.A11_BUILD_COMMAND || null,
  // Répertoire courant pour ExecuteShell (sinon workspaceRoot)
  shellCwd: process.env.A11_SHELL_CWD || null
});

// Last generated GIF path (absolute on disk)
let lastGifPath = null;

function _find_idle_asset() {
  // try server local public assets, then web public assets
  const cand = [
    path.join(__dirname, 'public', 'assets', 'a11_static.png'),
    path.join(__dirname, 'public', 'assets', 'A11_idle.png'),
    path.resolve(__dirname, '..', 'web', 'public', 'assets', 'a11_static.png'),
    path.resolve(__dirname, '..', 'web', 'public', 'assets', 'A11_idle.png'),
    path.resolve(__dirname, '..', 'web', 'public', 'assets', 'A11_talking_smooth_8s.gif')
  ];
  for (const p of cand) {
    try { if (fs.existsSync(p)) return p; } catch {};
  }
  return null;
}

// CORS configuration: allow local dev origins and production origin
const defaultCorsOrigins = ['http://127.0.0.1:3000', 'http://localhost:5173', 'http://localhost:3000', 'https://funesterie.pro', 'https://alphaonze.netlify.app', 'https://a11.funesterie.pro'];
const normalizeOrigin = (origin) => String(origin || '').trim().replace(/\/$/, '');
const envCorsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);
const CORS_ORIGINS = (envCorsOrigins.length ? envCorsOrigins : defaultCorsOrigins)
  .map(normalizeOrigin)
  .filter(Boolean);

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (e.g., curl, mobile clients)
    if (!origin) return callback(null, true);
    const incomingOrigin = normalizeOrigin(origin);
    
    // Check exact matches
    if (CORS_ORIGINS.includes(incomingOrigin)) return callback(null, true);
    
    // Allow Netlify preview deployments: https://xxxxx--a11funesterie.netlify.app
    const netlifyPreviewPattern = /https:\/\/[a-z0-9-]*--a11funesterie\.netlify\.app$/i;
    if (netlifyPreviewPattern.test(incomingOrigin)) {
      console.log('[A11][CORS] ✅ allowed Netlify preview:', incomingOrigin);
      return callback(null, true);
    }
    
    console.warn('[A11][CORS] origin denied:', incomingOrigin, 'allowed:', CORS_ORIGINS.join(','));
    return callback(new Error('CORS origin denied'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-NEZ-TOKEN', 'X-NEZ-ADMIN']
};

// Use CORS middleware globally
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ============================================================
// PostgreSQL pool (Railway Postgres)
// ============================================================
const db = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

const CHAT_MEMORY_LIMIT = Number(process.env.CHAT_MEMORY_LIMIT || 15);
const LOGICAL_MEMORY_UPDATE_EVERY = Number(process.env.LOGICAL_MEMORY_UPDATE_EVERY || 3);
const FACT_MEMORY_LIMIT = Number(process.env.FACT_MEMORY_LIMIT || 20);
const TASK_MEMORY_LIMIT = Number(process.env.TASK_MEMORY_LIMIT || 15);
const FILE_MEMORY_LIMIT = Number(process.env.FILE_MEMORY_LIMIT || 10);
const FACT_MIN_RELEVANCE = Number(process.env.FACT_MIN_RELEVANCE || 0.2);
const FACT_RETENTION_DAYS = Number(process.env.FACT_RETENTION_DAYS || 45);
const TASK_RETENTION_DAYS = Number(process.env.TASK_RETENTION_DAYS || 60);
const FILE_RETENTION_DAYS = Number(process.env.FILE_RETENTION_DAYS || 120);
const MEMORY_PURGE_EVERY_USER_MESSAGES = Number(process.env.MEMORY_PURGE_EVERY_USER_MESSAGES || 50);
const DEFAULT_QFLUSH_MEMORY_SUMMARY_FLOW = 'a11.memory.summary.v1';
const R2_ENDPOINT = String(process.env.R2_ENDPOINT || '').trim();
const R2_ACCESS_KEY = String(process.env.R2_ACCESS_KEY || '').trim();
const R2_SECRET_KEY = String(process.env.R2_SECRET_KEY || '').trim();
const R2_BUCKET = String(process.env.R2_BUCKET || '').trim();
const R2_PUBLIC_BASE_URL = String(process.env.R2_PUBLIC_BASE_URL || '').trim();
const FILE_UPLOAD_MAX_BYTES = Number(process.env.FILE_UPLOAD_MAX_BYTES || 10 * 1024 * 1024);
const DEFAULT_ADMIN_USERNAME = String(process.env.DEFAULT_ADMIN_USERNAME || 'Djeff').trim();
const DEFAULT_ADMIN_PASSWORD = String(process.env.DEFAULT_ADMIN_PASSWORD || '1991');
const DEFAULT_ADMIN_EMAIL = String(process.env.DEFAULT_ADMIN_EMAIL || 'djeff@a11.local').trim().toLowerCase();

if (db) {
  db.connect()
    .then(async (client) => {
      client.release();
      console.log('[DB] ✅ PostgreSQL connecté');
      try {
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT');
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP');
        await db.query(`
          CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            conversation_id TEXT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_messages_user_created_at ON messages (user_id, created_at DESC)');
        await db.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id TEXT');
        await db.query('CREATE INDEX IF NOT EXISTS idx_messages_user_conversation_created_at ON messages (user_id, conversation_id, created_at DESC)');
        await db.query(`
          CREATE TABLE IF NOT EXISTS user_memory (
            user_id TEXT PRIMARY KEY,
            summary TEXT,
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        await db.query(`
          CREATE TABLE IF NOT EXISTS files (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            storage_key TEXT NOT NULL,
            url TEXT NOT NULL,
            content_type TEXT,
            size_bytes INTEGER,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_files_user_created_at ON files (user_id, created_at DESC)');
        await db.query(`
          CREATE TABLE IF NOT EXISTS user_facts (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            fact_key TEXT NOT NULL,
            fact_value TEXT NOT NULL,
            confidence REAL,
            relevance_score REAL DEFAULT 0.5,
            source TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            last_seen_at TIMESTAMP DEFAULT NOW(),
            last_used_at TIMESTAMP,
            UNIQUE (user_id, fact_key)
          )
        `);
        await db.query('ALTER TABLE user_facts ADD COLUMN IF NOT EXISTS relevance_score REAL DEFAULT 0.5');
        await db.query('ALTER TABLE user_facts ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP');
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_facts_user_updated ON user_facts (user_id, updated_at DESC)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_facts_user_relevance ON user_facts (user_id, relevance_score DESC, updated_at DESC)');
        await db.query(`
          CREATE TABLE IF NOT EXISTS user_tasks (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            priority TEXT,
            due_at TIMESTAMP,
            source TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            closed_at TIMESTAMP
          )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_tasks_user_status_updated ON user_tasks (user_id, status, updated_at DESC)');
        await db.query(`
          CREATE TABLE IF NOT EXISTS user_files (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            storage_key TEXT,
            url TEXT,
            content_type TEXT,
            size_bytes INTEGER,
            origin TEXT DEFAULT 'upload',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE (user_id, storage_key)
          )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_user_files_user_created ON user_files (user_id, created_at DESC)');

        const adminLookup = await db.query(
          'SELECT id FROM users WHERE LOWER(username)=LOWER($1) OR LOWER(email)=LOWER($2) LIMIT 1',
          [DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL]
        );
        if (!adminLookup.rows.length) {
          const adminHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
          await db.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1,$2,$3)',
            [DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL, adminHash]
          );
          console.log('[AUTH] ✅ Admin bootstrap account created:', DEFAULT_ADMIN_USERNAME);
        }
        console.log('[DB] ✅ users.reset_token columns vérifiées');
        console.log('[DB] ✅ chat memory tables vérifiées');
        console.log('[DB] ✅ structured memory tables vérifiées');
      } catch (schemaErr) {
        console.warn('[DB] ⚠️ Migration reset token non appliquée:', schemaErr.message);
      }
    })
    .catch(e => console.error('[DB] ❌ Connexion PostgreSQL échouée:', e.message));
} else {
  console.warn('[DB] DATABASE_URL non défini, authentification DB désactivée');
}

function normalizeConversationId(conversationId) {
  const normalized = String(conversationId || '').trim();
  return normalized || 'default';
}

function looksLikeInternalPromptLeak(content) {
  const normalized = String(content || '').trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('# nindo') ||
    normalized.includes('# règles') ||
    normalized.includes('règles strictes') ||
    normalized.includes('tu ne réponds') ||
    normalized.includes('"mode": "actions"') ||
    normalized.includes('"actions": [')
  );
}

async function saveChatMemoryMessage(userId, role, content, conversationId) {
  const normalizedUserId = String(userId || '').trim();
  const normalizedConversationId = normalizeConversationId(conversationId);
  const normalizedRole = String(role || '').trim().toLowerCase();
  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  if (!db || !normalizedUserId || !normalizedRole || !normalizedContent) return;
  if (normalizedRole === 'assistant' && looksLikeInternalPromptLeak(normalizedContent)) return;

  await db.query(
    'INSERT INTO messages (user_id, conversation_id, role, content) VALUES ($1, $2, $3, $4)',
    [normalizedUserId, normalizedConversationId, normalizedRole, normalizedContent]
  );
}

async function getRecentChatMemory(userId, limit = CHAT_MEMORY_LIMIT, conversationId) {
  const normalizedUserId = String(userId || '').trim();
  const normalizedConversationId = normalizeConversationId(conversationId);
  if (!db || !normalizedUserId) return [];

  const result = await db.query(
    'SELECT role, content, created_at FROM messages WHERE user_id=$1 AND COALESCE(conversation_id, $2)=$2 ORDER BY created_at DESC, id DESC LIMIT $3',
    [normalizedUserId, normalizedConversationId, limit]
  );

  return [...result.rows].reverse().map((row) => ({
    role: String(row.role || 'user'),
    content: String(row.content || '')
  }));
}

async function getLogicalUserMemory(userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!db || !normalizedUserId) return '';

  const result = await db.query(
    'SELECT summary FROM user_memory WHERE user_id=$1 LIMIT 1',
    [normalizedUserId]
  );

  return String(result.rows[0]?.summary || '').trim();
}

async function countUserMessages(userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!db || !normalizedUserId) return 0;

  const result = await db.query(
    'SELECT COUNT(*)::int AS count FROM messages WHERE user_id=$1 AND role=$2',
    [normalizedUserId, 'user']
  );

  return Number(result.rows[0]?.count || 0);
}

function shouldRefreshLogicalMemory(messageCount) {
  if (!Number.isFinite(messageCount) || messageCount <= 0) return false;
  return messageCount % LOGICAL_MEMORY_UPDATE_EVERY === 0;
}

async function refreshLogicalUserMemory(userId, latestUserMessage, recentMessages) {
  const summaryFlow = getQflushMemorySummaryFlow();
  const normalizedUserId = String(userId || '').trim();
  const normalizedLatestMessage = typeof latestUserMessage === 'string' ? latestUserMessage.trim() : '';

  if (!db || !normalizedUserId || !normalizedLatestMessage) {
    return '';
  }

  const previousSummary = await getLogicalUserMemory(normalizedUserId);
  const summaryResult = await runLogicalMemorySummaryFlow({
    flow: summaryFlow,
    userId: normalizedUserId,
    previousSummary,
    latestUserMessage: normalizedLatestMessage,
    recentMessages,
  });

  const nextSummary = extractAssistantText(summaryResult).trim() || previousSummary;
  if (!nextSummary) return '';

  await db.query(
    `INSERT INTO user_memory (user_id, summary, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET summary = EXCLUDED.summary, updated_at = NOW()`,
    [normalizedUserId, nextSummary]
  );

  return nextSummary;
}

async function pruneChatMemory() {
  if (!db) return;
  await db.query(`DELETE FROM messages WHERE created_at < NOW() - INTERVAL '7 days'`);
}

function normalizeMemoryText(value) {
  return String(value || '').replaceAll(/\s+/g, ' ').trim();
}

function cleanupExtractedValue(value) {
  const normalized = normalizeMemoryText(value).replaceAll(/[\s,.;:!?-]+$/g, '').trim();
  return normalized.slice(0, 240);
}

function execCapture(text, regex, groupIndex = 1) {
  const matcher = regex instanceof RegExp ? regex : null;
  if (!matcher) return '';
  const match = matcher.exec(String(text || ''));
  if (!match) return '';
  return String(match[groupIndex] || '').trim();
}

function parseDateCandidate(raw) {
  const candidate = String(raw || '').trim();
  if (!candidate) return null;

  const isoRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const isoMatch = isoRegex.exec(candidate);
  if (isoMatch) {
    const date = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const frRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const frMatch = frRegex.exec(candidate);
  if (frMatch) {
    const day = frMatch[1].padStart(2, '0');
    const month = frMatch[2].padStart(2, '0');
    const year = frMatch[3];
    const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const parsed = new Date(candidate);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

function dedupeByStableKey(items, keyBuilder) {
  const seen = new Set();
  const output = [];
  for (const item of items || []) {
    const key = String(keyBuilder(item) || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return numeric;
}

function getFactTypeWeight(factKey) {
  const key = String(factKey || '').toLowerCase();
  if (key.startsWith('context.project')) return 1;
  if (key.startsWith('profile.')) return 0.95;
  if (key.startsWith('tech.')) return 0.9;
  if (key.startsWith('preferences.')) return 0.85;
  if (key.startsWith('contact.')) return 0.8;
  return 0.65;
}

function computeFactRelevance(fact) {
  const confidence = clamp01(fact?.confidence ?? 0.6);
  const typeWeight = getFactTypeWeight(fact?.key);
  const text = normalizeMemoryText(fact?.value || '');
  const genericPenalty = /\b(ok|merci|thanks|cool|yes|no|lol|haha)\b/i.test(text) ? 0.25 : 0;
  const shortPenalty = text.length < 6 ? 0.2 : 0;

  return clamp01(confidence * 0.65 + typeWeight * 0.35 - genericPenalty - shortPenalty);
}

function extractFactsFromMessage(message) {
  const text = normalizeMemoryText(message);
  if (!text) return [];

  const lower = text.toLowerCase();
  const facts = [];

  const pushFact = (key, value, confidence = 0.7) => {
    const cleaned = cleanupExtractedValue(value);
    if (!cleaned) return;
    facts.push({ key, value: cleaned, confidence, source: 'chat_message' });
  };

  const name = execCapture(text, /\b(?:my name is|i am called|je m'appelle)\s+([^.,!\n]+)/i);
  if (name) pushFact('profile.name', name, 0.9);

  const location = execCapture(text, /\b(?:i live in|j'habite(?: a| en)?|je vis(?: a| en)?)\s+([^.,!\n]+)/i);
  if (location) pushFact('profile.location', location, 0.8);

  const timezone = execCapture(text, /\b(?:my timezone is|timezone|fuseau horaire)\s*[:=]?\s*([^.,!\n]+)/i);
  if (timezone) pushFact('profile.timezone', timezone, 0.8);

  const preference = execCapture(text, /\b(?:i prefer|je prefere|i like|j'aime)\s+([^.!?\n]+)/i);
  if (preference) pushFact('preferences.general', preference, 0.65);

  const email = execCapture(text, /\b(?:my email is|email me at|mon email est)\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  if (email) pushFact('contact.email', email, 0.95);

  const project = execCapture(text, /\b(?:i work on|je travaille sur|project|projet)\s+([^.!?\n]+)/i);
  if (project) pushFact('context.project', project, 0.6);

  if (lower.includes('node') || lower.includes('javascript')) {
    pushFact('tech.stack_hint', 'node/javascript', 0.55);
  }

  return dedupeByStableKey(facts, (fact) => fact.key);
}

function collectTaskMatches(text, regex) {
  const tasks = [];
  const input = String(text || '');
  const rx = new RegExp(regex.source, regex.flags);
  let match = rx.exec(input);

  while (match !== null) {
    const description = cleanupExtractedValue(match[1]);
    if (description && description.length >= 4) {
      const dueCapture = execCapture(description, /(?:by|avant|pour le|due)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i);
      const dueDate = dueCapture ? parseDateCandidate(dueCapture) : null;
      const closed = /\b(done|termine|completed|fini)\b/i.test(input);

      tasks.push({
        description: description.slice(0, 260),
        status: closed ? 'done' : 'open',
        priority: /\b(urgent|critical|important|prioritaire)\b/i.test(description) ? 'high' : 'normal',
        dueAt: dueDate,
        source: 'chat_message',
      });
    }
    match = rx.exec(input);
  }

  return tasks;
}

function extractTasksFromMessage(message) {
  const text = normalizeMemoryText(message);
  if (!text) return [];

  const taskRegexes = [
    /(?:rappelle[- ]?moi de|remember to|i need to|i must|je dois|il faut que)\s+([^.!?\n]+)/gi,
    /(?:todo|to-do|a faire|task)\s*[:-]?\s*([^\n]+)/gi,
    /(?:next step|prochaine etape)\s*[:-]?\s*([^\n]+)/gi,
  ];

  const tasks = taskRegexes.flatMap((regex) => collectTaskMatches(text, regex));

  return dedupeByStableKey(tasks, (task) => task.description.toLowerCase()).slice(0, 5);
}

async function upsertUserFacts(userId, facts) {
  const normalizedUserId = String(userId || '').trim();
  if (!db || !normalizedUserId || !Array.isArray(facts) || !facts.length) return;

  for (const fact of facts) {
    const key = normalizeMemoryText(fact?.key).slice(0, 120);
    const value = normalizeMemoryText(fact?.value).slice(0, 500);
    if (!key || !value) continue;

    const confidence = Number.isFinite(Number(fact?.confidence)) ? Number(fact.confidence) : null;
    const relevanceScore = computeFactRelevance(fact);
    const source = normalizeMemoryText(fact?.source || 'chat_message').slice(0, 80);

    await db.query(
      `INSERT INTO user_facts (user_id, fact_key, fact_value, confidence, relevance_score, source, last_seen_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (user_id, fact_key)
       DO UPDATE SET
         fact_value = EXCLUDED.fact_value,
         confidence = COALESCE(EXCLUDED.confidence, user_facts.confidence),
         relevance_score = GREATEST(COALESCE(EXCLUDED.relevance_score, 0), COALESCE(user_facts.relevance_score, 0)),
         source = EXCLUDED.source,
         last_seen_at = NOW(),
         updated_at = NOW()`,
      [normalizedUserId, key, value, confidence, relevanceScore, source]
    );
  }
}

async function markFactsAsUsed(userId, facts) {
  const normalizedUserId = String(userId || '').trim();
  if (!db || !normalizedUserId || !Array.isArray(facts) || !facts.length) return;

  const keys = facts
    .map((fact) => normalizeMemoryText(fact?.key).slice(0, 120))
    .filter(Boolean);
  if (!keys.length) return;

  await db.query(
    `UPDATE user_facts
     SET last_used_at = NOW()
     WHERE user_id = $1
       AND fact_key = ANY($2::text[])`,
    [normalizedUserId, keys]
  );
}

async function pruneStructuredMemory(userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!db || !normalizedUserId) return;

  const factRetentionDays = Math.max(7, FACT_RETENTION_DAYS);
  const taskRetentionDays = Math.max(14, TASK_RETENTION_DAYS);
  const fileRetentionDays = Math.max(14, FILE_RETENTION_DAYS);

  await db.query(
    `DELETE FROM user_facts
     WHERE user_id = $1
       AND (
         relevance_score < $2
         OR updated_at < NOW() - ($3 * INTERVAL '1 day')
       )
       AND COALESCE(last_used_at, updated_at) < NOW() - (GREATEST(7, $3 / 2) * INTERVAL '1 day')`,
    [normalizedUserId, FACT_MIN_RELEVANCE, factRetentionDays]
  );

  await db.query(
    `DELETE FROM user_tasks
     WHERE user_id = $1
       AND status = 'done'
       AND COALESCE(closed_at, updated_at) < NOW() - ($2 * INTERVAL '1 day')`,
    [normalizedUserId, taskRetentionDays]
  );

  await db.query(
    `DELETE FROM user_files
     WHERE user_id = $1
       AND created_at < NOW() - ($2 * INTERVAL '1 day')`,
    [normalizedUserId, fileRetentionDays]
  );
}

async function saveUserTasks(userId, tasks) {
  const normalizedUserId = String(userId || '').trim();
  if (!db || !normalizedUserId || !Array.isArray(tasks) || !tasks.length) return;

  for (const task of tasks) {
    const description = normalizeMemoryText(task?.description).slice(0, 300);
    if (!description) continue;

    const status = String(task?.status || 'open').trim().toLowerCase();
    const normalizedStatus = ['open', 'in_progress', 'done', 'blocked'].includes(status) ? status : 'open';
    const priority = normalizeMemoryText(task?.priority || 'normal').slice(0, 40);
    const source = normalizeMemoryText(task?.source || 'chat_message').slice(0, 80);
    const dueAt = task?.dueAt instanceof Date && !Number.isNaN(task.dueAt.getTime()) ? task.dueAt.toISOString() : null;

    const existing = await db.query(
      `SELECT id FROM user_tasks
       WHERE user_id=$1
         AND LOWER(TRIM(description))=LOWER(TRIM($2))
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`,
      [normalizedUserId, description]
    );

    if (existing.rows.length) {
      await db.query(
        `UPDATE user_tasks
         SET status=$2,
             priority=$3,
             due_at=COALESCE($4::timestamp, due_at),
             source=$5,
             updated_at=NOW(),
             closed_at=CASE WHEN $2='done' THEN NOW() ELSE NULL END
         WHERE id=$1`,
        [existing.rows[0].id, normalizedStatus, priority || null, dueAt, source]
      );
      continue;
    }

    await db.query(
      `INSERT INTO user_tasks (user_id, description, status, priority, due_at, source, created_at, updated_at, closed_at)
       VALUES ($1, $2, $3, $4, $5::timestamp, $6, NOW(), NOW(), CASE WHEN $3='done' THEN NOW() ELSE NULL END)`,
      [normalizedUserId, description, normalizedStatus, priority || null, dueAt, source]
    );
  }
}

async function saveStructuredMemoryFromMessage(userId, message) {
  const normalizedUserId = String(userId || '').trim();
  const normalizedMessage = normalizeMemoryText(message);
  if (!db || !normalizedUserId || !normalizedMessage) return;

  const facts = extractFactsFromMessage(normalizedMessage);
  const tasks = extractTasksFromMessage(normalizedMessage);

  if (facts.length) {
    await upsertUserFacts(normalizedUserId, facts);
  }

  if (tasks.length) {
    await saveUserTasks(normalizedUserId, tasks);
  }
}

async function saveUserFileMemory({ userId, filename, storageKey, url, contentType, sizeBytes, origin }) {
  const normalizedUserId = String(userId || '').trim();
  const normalizedFilename = normalizeMemoryText(filename).slice(0, 220);
  const normalizedStorageKey = normalizeMemoryText(storageKey).slice(0, 500);
  const normalizedUrl = normalizeMemoryText(url).slice(0, 1200);
  if (!db || !normalizedUserId || !normalizedFilename) return;

  if (normalizedStorageKey) {
    await db.query(
      `INSERT INTO user_files (user_id, filename, storage_key, url, content_type, size_bytes, origin, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (user_id, storage_key)
       DO UPDATE SET
         filename=EXCLUDED.filename,
         url=EXCLUDED.url,
         content_type=EXCLUDED.content_type,
         size_bytes=EXCLUDED.size_bytes,
         origin=EXCLUDED.origin,
         updated_at=NOW()`,
      [
        normalizedUserId,
        normalizedFilename,
        normalizedStorageKey,
        normalizedUrl || null,
        normalizeMemoryText(contentType || '').slice(0, 100) || null,
        Number(sizeBytes || 0),
        normalizeMemoryText(origin || 'upload').slice(0, 80) || 'upload',
      ]
    );
    return;
  }

  await db.query(
    `INSERT INTO user_files (user_id, filename, storage_key, url, content_type, size_bytes, origin, created_at, updated_at)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, NOW(), NOW())`,
    [
      normalizedUserId,
      normalizedFilename,
      normalizedUrl || null,
      normalizeMemoryText(contentType || '').slice(0, 100) || null,
      Number(sizeBytes || 0),
      normalizeMemoryText(origin || 'upload').slice(0, 80) || 'upload',
    ]
  );
}

async function getUserFacts(userId, limit = FACT_MEMORY_LIMIT) {
  const normalizedUserId = String(userId || '').trim();
  if (!db || !normalizedUserId) return [];

  const normalizedLimit = Math.max(1, Math.min(50, Number(limit || FACT_MEMORY_LIMIT)));
  const result = await db.query(
    `SELECT fact_key, fact_value, confidence, relevance_score, source, updated_at, last_used_at
     FROM user_facts
     WHERE user_id=$1
       AND COALESCE(relevance_score, 0.5) >= $3
     ORDER BY COALESCE(relevance_score, 0.5) DESC,
              COALESCE(last_used_at, updated_at) DESC,
              updated_at DESC,
              id DESC
     LIMIT $2`,
    [normalizedUserId, normalizedLimit, FACT_MIN_RELEVANCE]
  );

  return result.rows.map((row) => ({
    key: String(row.fact_key || ''),
    value: String(row.fact_value || ''),
    confidence: Number(row.confidence || 0),
    relevanceScore: Number(row.relevance_score || 0.5),
    source: String(row.source || ''),
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
  }));
}

async function getUserTasks(userId, limit = TASK_MEMORY_LIMIT) {
  const normalizedUserId = String(userId || '').trim();
  if (!db || !normalizedUserId) return [];

  const normalizedLimit = Math.max(1, Math.min(50, Number(limit || TASK_MEMORY_LIMIT)));
  const result = await db.query(
    `SELECT id, description, status, priority, due_at, source, updated_at
     FROM user_tasks
     WHERE user_id=$1
     ORDER BY CASE WHEN status='open' THEN 0 WHEN status='in_progress' THEN 1 WHEN status='blocked' THEN 2 ELSE 3 END,
              updated_at DESC,
              id DESC
     LIMIT $2`,
    [normalizedUserId, normalizedLimit]
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    description: String(row.description || ''),
    status: String(row.status || 'open'),
    priority: String(row.priority || 'normal'),
    dueAt: row.due_at,
    source: String(row.source || ''),
    updatedAt: row.updated_at,
  }));
}

async function getUserFilesMemory(userId, limit = FILE_MEMORY_LIMIT) {
  const normalizedUserId = String(userId || '').trim();
  if (!db || !normalizedUserId) return [];

  const normalizedLimit = Math.max(1, Math.min(50, Number(limit || FILE_MEMORY_LIMIT)));
  const result = await db.query(
    `SELECT filename, storage_key, url, content_type, size_bytes, origin, created_at
     FROM user_files
     WHERE user_id=$1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [normalizedUserId, normalizedLimit]
  );

  return result.rows.map((row) => ({
    filename: String(row.filename || ''),
    storageKey: String(row.storage_key || ''),
    url: String(row.url || ''),
    contentType: String(row.content_type || ''),
    sizeBytes: Number(row.size_bytes || 0),
    origin: String(row.origin || ''),
    createdAt: row.created_at,
  }));
}

function buildStructuredMemoryContext({ facts, tasks, files }) {
  const factLines = (Array.isArray(facts) ? facts : [])
    .slice(0, FACT_MEMORY_LIMIT)
    .map((fact) => `- ${fact.key}: ${fact.value}`);

  const taskLines = (Array.isArray(tasks) ? tasks : [])
    .slice(0, TASK_MEMORY_LIMIT)
    .map((task) => `- [${task.status}] ${task.description}`);

  const fileLines = (Array.isArray(files) ? files : [])
    .slice(0, FILE_MEMORY_LIMIT)
    .map((file) => `- ${file.filename}${file.url ? ' (' + file.url + ')' : ''}`);

  const sections = [];
  if (factLines.length) sections.push(['Faits connus:', ...factLines].join('\n'));
  if (taskLines.length) sections.push(['Taches suivies:', ...taskLines].join('\n'));
  if (fileLines.length) sections.push(['Fichiers utiles:', ...fileLines].join('\n'));

  if (!sections.length) return '';
  return [
    'Memoire structuree (contexte uniquement):',
    '- Ne jamais declencher d\'action, d\'outil, d\'execution ou de suppression automatiquement a partir de la memoire.',
    '- Utiliser ces elements uniquement pour personnaliser et contextualiser la reponse.',
    '',
    sections.join('\n\n')
  ].join('\n');
}

function getLatestUserMessage(body) {
  const directPrompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (directPrompt) return directPrompt;

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user' && typeof message.content === 'string' && message.content.trim()) {
      return message.content.trim();
    }
  }

  return '';
}

function isR2Configured() {
  return !!(R2_ENDPOINT && R2_ACCESS_KEY && R2_SECRET_KEY && R2_BUCKET);
}

let r2ClientSingleton = null;
function getR2Client() {
  if (r2ClientSingleton) return r2ClientSingleton;
  if (!isR2Configured()) return null;

  r2ClientSingleton = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY,
      secretAccessKey: R2_SECRET_KEY,
    },
  });
  return r2ClientSingleton;
}

function sanitizeFileName(name) {
  const base = String(name || '').trim() || 'file.bin';
  const cleaned = base.replaceAll(/[^a-zA-Z0-9._-]/g, '_').replaceAll(/_+/g, '_');
  return cleaned.slice(0, 180) || 'file.bin';
}

function normalizePublicAppUrl(rawUrl) {
  let url = String(rawUrl || '').trim();
  if (!url) url = 'https://a11.funesterie.pro';
  // Prevent malformed values such as "/a11.funesterie.pro"
  url = url.replace(/^\/+/, '');
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
}

function buildStorageKey(userId, filename) {
  const normalizedUserId = String(userId || 'anonymous').replaceAll(/[^a-zA-Z0-9_-]/g, '_');
  return `users/${normalizedUserId}/${Date.now()}-${sanitizeFileName(filename)}`;
}

function getFilePublicUrl(storageKey) {
  if (R2_PUBLIC_BASE_URL) {
    return `${R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${storageKey}`;
  }
  return `${R2_ENDPOINT.replace(/\/$/, '')}/${R2_BUCKET}/${storageKey}`;
}

async function uploadBufferToR2({ userId, filename, buffer, contentType }) {
  const client = getR2Client();
  if (!client) {
    throw new Error('R2 is not configured');
  }

  const storageKey = buildStorageKey(userId, filename);
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: storageKey,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
  }));

  return {
    storageKey,
    url: getFilePublicUrl(storageKey),
  };
}

async function saveFileRecord({ userId, filename, storageKey, url, contentType, sizeBytes }) {
  if (!db) return null;

  const result = await db.query(
    `INSERT INTO files (user_id, filename, storage_key, url, content_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, filename, storage_key, url, content_type, size_bytes, created_at`,
    [userId, filename, storageKey, url, contentType || null, Number(sizeBytes || 0)]
  );

  return result.rows[0] || null;
}

// ============================================================
// Email providers
// Priority: Resend API, then SMTP/Gmail fallback
// ============================================================
const resendApiKey = String(process.env.RESEND_API_KEY || '').trim();
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

const hasSmtpConfig = !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
const hasGmailConfig = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

let emailTransporter = null;
if (hasSmtpConfig) {
  emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
} else if (hasGmailConfig) {
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

if (resendClient) {
  console.log('[MAIL] ✅ Resend provider activé');
}

if (!resendClient && !emailTransporter) {
  console.warn('[MAIL] Aucun provider mail configuré (RESEND_API_KEY ou SMTP_* ou EMAIL_*)');
} else if (emailTransporter) {
  emailTransporter.verify()
    .then(() => console.log('[MAIL] ✅ Transport SMTP prêt'))
    .catch((e) => console.error('[MAIL] ❌ Transport SMTP invalide:', e.message));
}

async function sendFileEmail({ to, subject, message, fileUrl, attachment }) {
  const normalizedTo = String(to || '').trim();
  if (!normalizedTo) return { ok: false, reason: 'missing_to' };

  const subjectLine = String(subject || 'A11 — Fichier généré').trim();
  const textBody = String(message || 'Voici ton fichier généré.').trim();
  const linkPart = fileUrl ? `\n\nLien: ${fileUrl}` : '';

  if (resendClient) {
    await resendClient.emails.send({
      from: process.env.EMAIL_FROM || 'A11 <onboarding@resend.dev>',
      to: normalizedTo,
      subject: subjectLine,
      text: `${textBody}${linkPart}`,
      attachments: attachment ? [{
        filename: attachment.filename,
        content: attachment.buffer,
      }] : undefined,
    });
    return { ok: true, provider: 'resend' };
  }

  if (emailTransporter) {
    await emailTransporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || process.env.SMTP_USER,
      to: normalizedTo,
      subject: subjectLine,
      text: `${textBody}${linkPart}`,
      attachments: attachment ? [{
        filename: attachment.filename,
        content: attachment.buffer,
      }] : undefined,
    });
    return { ok: true, provider: 'smtp' };
  }

  return { ok: false, reason: 'mail_provider_not_configured' };
}

// Ajout express.json AVANT les proxies pour garantir le body POST
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/tts', express.static(path.join(__dirname, '../../public/tts')));

// SUPPRESSION des premiers express.json / express.urlencoded
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// Routes OpenAI / LLM classiques
registerOpenAIRoutes(router);

// Routes A11Host (VSIX + headless)
registerA11HostRoutes(router);

// Monter le router principal sous /api
app.use('/api', router);

// Monter les routes TTS (Piper) sous /api aussi
try {
  const ttsRouter = require('./routes/tts.cjs');   // ← c'est déjà un express.Router()
  app.use('/api', ttsRouter);
  console.log('[Server] TTS routes mounted under /api');
} catch ( e) {
  console.warn('[Server] Failed to register TTS routes:', e?.message);
}

// ✅ LOGIN ROUTE (public, no auth required)
// ✅ JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = '24h';

// ⚠️ SECURITY WARNING: si JWT_SECRET est le default, on log un warning en prod
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev-secret-change-in-production') {
  console.error('[SECURITY] ⚠️⚠️⚠️ JWT_SECRET is set to DEFAULT - SET IT IN PRODUCTION! ⚠️⚠️⚠️');
  console.error('[SECURITY] Si tu deploys sur Railway: ajoute JWT_SECRET dans les variables d\'env');
}

// ✅ JWT verification middleware
function verifyJWT(req, res, next) {
  const token = req.headers['x-nez-token'] || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    console.warn('[JWT] No token provided');
    return res.status(401).json({
      error: 'A11_JWT_Missing',
      message: 'JWT token manquant'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    console.log('[JWT] ✅ Token vérifié pour user:', decoded.username);
    next();
  } catch (err) {
    console.warn('[JWT] Verification failed:', err.message);
    return res.status(401).json({
      error: 'A11_JWT_Invalid',
      message: `JWT invalide ou expiré: ${err.message}`
    });
  }
}

function isAdminRequest(req) {
  const configuredAdminToken = String(process.env.NEZ_ADMIN_TOKEN || '').trim();
  const adminHeader = String(req.headers['x-nez-admin'] || '').trim();
  if (configuredAdminToken && adminHeader && adminHeader === configuredAdminToken) {
    return true;
  }

  const userId = String(req.user?.id || '').trim().toLowerCase();
  const username = String(req.user?.username || '').trim().toLowerCase();
  const normalizedDefaultAdmin = DEFAULT_ADMIN_USERNAME.toLowerCase();
  return userId === 'admin' || username === 'admin' || username === normalizedDefaultAdmin;
}

async function getStructuredMemoryCounts(userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!db || !normalizedUserId) {
    return { facts: 0, tasks: 0, files: 0 };
  }

  const [factsRes, tasksRes, filesRes] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS count FROM user_facts WHERE user_id=$1', [normalizedUserId]),
    db.query('SELECT COUNT(*)::int AS count FROM user_tasks WHERE user_id=$1', [normalizedUserId]),
    db.query('SELECT COUNT(*)::int AS count FROM user_files WHERE user_id=$1', [normalizedUserId]),
  ]);

  return {
    facts: Number(factsRes.rows[0]?.count || 0),
    tasks: Number(tasksRes.rows[0]?.count || 0),
    files: Number(filesRes.rows[0]?.count || 0),
  };
}

async function getStructuredMemoryPurgeCandidates(userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!db || !normalizedUserId) {
    return { facts: 0, tasks: 0, files: 0 };
  }

  const factRetentionDays = Math.max(7, FACT_RETENTION_DAYS);
  const taskRetentionDays = Math.max(14, TASK_RETENTION_DAYS);
  const fileRetentionDays = Math.max(14, FILE_RETENTION_DAYS);

  const [factsRes, tasksRes, filesRes] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM user_facts
       WHERE user_id = $1
         AND (
           relevance_score < $2
           OR updated_at < NOW() - ($3 * INTERVAL '1 day')
         )
         AND COALESCE(last_used_at, updated_at) < NOW() - (GREATEST(7, $3 / 2) * INTERVAL '1 day')`,
      [normalizedUserId, FACT_MIN_RELEVANCE, factRetentionDays]
    ),
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM user_tasks
       WHERE user_id = $1
         AND status = 'done'
         AND COALESCE(closed_at, updated_at) < NOW() - ($2 * INTERVAL '1 day')`,
      [normalizedUserId, taskRetentionDays]
    ),
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM user_files
       WHERE user_id = $1
         AND created_at < NOW() - ($2 * INTERVAL '1 day')`,
      [normalizedUserId, fileRetentionDays]
    ),
  ]);

  return {
    facts: Number(factsRes.rows[0]?.count || 0),
    tasks: Number(tasksRes.rows[0]?.count || 0),
    files: Number(filesRes.rows[0]?.count || 0),
  };
}

// ✅ LOGIN ROUTE - renvoie un JWT signé
// ✅ REGISTER
app.post('/api/auth/register', express.json(), async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { username, email, password } = req.body || {};
  const normalizedUsername = String(username || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedUsername || !normalizedEmail || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1,$2,$3)',
      [normalizedUsername, normalizedEmail, hash]
    );
    console.log('[AUTH] ✅ Register:', normalizedUsername);
    res.json({ ok: true });
  } catch (e) {
    console.warn('[AUTH] Register failed:', e.message);
    res.status(400).json({ error: 'User already exists' });
  }
});

// ✅ LOGIN - renvoie un JWT signé
app.post('/api/auth/login', express.json(), async (req, res) => {
  const { email, username, password } = req.body || {};
  const identifier = String(email || username || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  console.log('[AUTH] Login attempt:', identifier || '(empty)');

  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }

  // Fallback hardcodé si pas de DB (dev sans DATABASE_URL)
  if (!db) {
    const { username: u, password: p } = req.body || {};
    const normalizedFallbackUser = String(u || '').trim().toLowerCase();
    const fallbackDefaultAdmin = DEFAULT_ADMIN_USERNAME.toLowerCase();
    const isLegacyAdmin = normalizedFallbackUser === 'admin' && p === '1234';
    const isDefaultAdmin = normalizedFallbackUser === fallbackDefaultAdmin && p === DEFAULT_ADMIN_PASSWORD;
    if (isLegacyAdmin || isDefaultAdmin) {
      const resolvedUsername = isLegacyAdmin ? 'admin' : DEFAULT_ADMIN_USERNAME;
      const token = jwt.sign({ username: resolvedUsername, id: resolvedUsername.toLowerCase() }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
      return res.json({ success: true, token, user: { id: resolvedUsername.toLowerCase(), username: resolvedUsername } });
    }
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  try {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE LOWER(email)=LOWER($1) OR username=$1 LIMIT 1',
      [normalizedEmail || identifier]
    );
    if (!rows.length) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    console.log('[AUTH] ✅ Login réussi:', user.username);
    res.json({ success: true, token, user: { id: user.id, username: user.username } });
  } catch (e) {
    console.error('[AUTH] Login error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ FORGOT PASSWORD
const forgotPasswordHandler = async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { email } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return res.status(400).json({ error: 'Missing email' });
  if (!resendClient && !emailTransporter) {
    console.warn('[AUTH] Forgot requested but email transport is not configured');
    return res.json({ ok: true, mailEnabled: false });
  }
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1)', [normalizedEmail]);
    // Toujours répondre ok pour ne pas révéler si l'email existe
    if (!rows.length) {
      console.warn('[AUTH] Forgot requested for unknown email');
      return res.json({ ok: true });
    }
    const user = rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.query(
      'UPDATE users SET reset_token=$1, reset_token_expires_at=$2 WHERE id=$3',
      [resetToken, expiresAt, user.id]
    );

    const appUrl = normalizePublicAppUrl(process.env.APP_URL || process.env.FRONT_URL || 'https://a11.funesterie.pro');
    const link = `${appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const fromEmail = process.env.EMAIL_FROM || 'A11 <onboarding@resend.dev>';

    if (resendClient) {
      await resendClient.emails.send({
        from: fromEmail,
        to: user.email,
        subject: 'A11 — Réinitialisation mot de passe',
        html: `<p>Clique ici pour réinitialiser ton mot de passe (valide 15 min):</p><p><a href="${link}">${link}</a></p>`
      });
    } else {
      await emailTransporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER || process.env.SMTP_USER,
        to: user.email,
        subject: 'A11 — Réinitialisation mot de passe',
        text: `Clique ici pour réinitialiser ton mot de passe (valide 15 min):\n\n${link}`
      });
    }
    console.log('[AUTH] ✅ Reset email envoyé à:', user.email);
    res.json({ ok: true, mailEnabled: true });
  } catch (e) {
    console.error('[AUTH] Forgot error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
};

app.post('/api/auth/forgot', express.json(), forgotPasswordHandler);
app.post('/api/auth/forgot-password', express.json(), forgotPasswordHandler);

// ✅ RESET PASSWORD
const resetPasswordHandler = async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { token, password, newPassword } = req.body || {};
  const effectivePassword = String(password || newPassword || '');
  if (!token || !effectivePassword) return res.status(400).json({ error: 'Missing fields' });
  try {
    const hash = await bcrypt.hash(effectivePassword, 10);

    // New flow: DB token with expiration
    const byResetToken = await db.query(
      'SELECT id FROM users WHERE reset_token=$1 AND reset_token_expires_at > NOW() LIMIT 1',
      [token]
    );

    if (byResetToken.rows.length) {
      const userId = byResetToken.rows[0].id;
      await db.query(
        'UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires_at=NULL WHERE id=$2',
        [hash, userId]
      );
      console.log('[AUTH] ✅ Password reset via DB token for user id:', userId);
      return res.json({ ok: true });
    }

    // Backward compatibility: previous JWT reset token format
    const decoded = jwt.verify(token, JWT_SECRET);
    await db.query(
      'UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires_at=NULL WHERE id=$2',
      [hash, decoded.id]
    );
    console.log('[AUTH] ✅ Password reset via JWT token for user id:', decoded.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('[AUTH] Reset error:', e.message);
    res.status(400).json({ error: 'Invalid or expired token' });
  }
};

app.post('/api/auth/reset', express.json(), resetPasswordHandler);
app.post('/api/auth/reset-password', express.json(), resetPasswordHandler);

app.get('/api/a11/history', verifyJWT, async (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const username = String(req.user?.username || '').trim();
    if (!db || !userId) return res.json([]);

    const summary = await db.query(
      'SELECT COUNT(*)::int AS count, MAX(created_at) AS updated_at FROM messages WHERE user_id=$1',
      [userId]
    );

    const row = summary.rows[0] || {};
    const count = Number(row.count || 0);
    if (!count) return res.json([]);

    return res.json([
      {
        id: `user-${userId}`,
        name: username ? `Historique de ${username}` : 'Historique du compte',
        updated: row.updated_at || new Date().toISOString(),
      }
    ]);
  } catch (e) {
    console.error('[A11][History] List error:', e?.message);
    return res.status(500).json({ error: 'history_list_failed' });
  }
});

app.get('/api/a11/history/:id', verifyJWT, async (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    if (!db || !userId) {
      return res.json({ id: req.params.id, messages: [] });
    }

    const expectedId = `user-${userId}`;
    if (req.params.id !== expectedId) {
      return res.status(404).json({ error: 'history_not_found' });
    }

    const result = await db.query(
      'SELECT id, role, content, created_at FROM messages WHERE user_id=$1 ORDER BY created_at ASC, id ASC LIMIT 200',
      [userId]
    );

    return res.json({
      id: expectedId,
      messages: result.rows.map((row) => ({
        id: `msg-${row.id}`,
        role: String(row.role || 'assistant'),
        content: String(row.content || ''),
        ts: row.created_at,
      })),
    });
  } catch (e) {
    console.error('[A11][History] Conversation error:', e?.message);
    return res.status(500).json({ error: 'history_conversation_failed' });
  }
});

// ✅ AUTH MIDDLEWARE - appliqué SEULEMENT sur /api/ai pour protéger chat
// /api/auth/login reste public!
app.use('/api/ai', verifyJWT);
app.use('/api/files', verifyJWT);

app.post('/api/files/upload', express.json({ limit: '20mb' }), async (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    if (!userId) return res.status(401).json({ ok: false, error: 'missing_user' });

    if (!isR2Configured()) {
      return res.status(503).json({ ok: false, error: 'r2_not_configured' });
    }

    const {
      filename,
      contentBase64,
      contentType,
      emailTo,
      emailSubject,
      emailMessage,
      attachToEmail,
    } = req.body || {};

    const safeFilename = sanitizeFileName(filename || 'generated-file.bin');
    const normalizedContentType = String(contentType || 'application/octet-stream').trim();
    const rawBase64 = String(contentBase64 || '').trim();
    const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',').pop() : rawBase64;
    if (!cleanBase64) {
      return res.status(400).json({ ok: false, error: 'missing_content_base64' });
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    if (!buffer.length) {
      return res.status(400).json({ ok: false, error: 'invalid_base64_content' });
    }
    if (buffer.length > FILE_UPLOAD_MAX_BYTES) {
      return res.status(413).json({ ok: false, error: 'file_too_large', maxBytes: FILE_UPLOAD_MAX_BYTES });
    }

    const uploaded = await uploadBufferToR2({
      userId,
      filename: safeFilename,
      buffer,
      contentType: normalizedContentType,
    });

    const record = await saveFileRecord({
      userId,
      filename: safeFilename,
      storageKey: uploaded.storageKey,
      url: uploaded.url,
      contentType: normalizedContentType,
      sizeBytes: buffer.length,
    });

    await saveUserFileMemory({
      userId,
      filename: safeFilename,
      storageKey: uploaded.storageKey,
      url: uploaded.url,
      contentType: normalizedContentType,
      sizeBytes: buffer.length,
      origin: 'upload',
    });

    let mail = null;
    if (emailTo) {
      mail = await sendFileEmail({
        to: emailTo,
        subject: emailSubject || 'A11 — fichier généré',
        message: emailMessage || 'Ton fichier est prêt.',
        fileUrl: uploaded.url,
        attachment: attachToEmail ? { filename: safeFilename, buffer } : null,
      });
    }

    return res.json({
      ok: true,
      file: {
        filename: safeFilename,
        storageKey: uploaded.storageKey,
        url: uploaded.url,
        contentType: normalizedContentType,
        sizeBytes: buffer.length,
      },
      record,
      mail,
    });
  } catch (e) {
    console.error('[FILES] upload failed:', e?.message);
    return res.status(500).json({ ok: false, error: 'upload_failed', message: String(e?.message) });
  }
});

app.get('/api/files/my', async (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    if (!userId) return res.status(401).json({ ok: false, error: 'missing_user' });
    if (!db) return res.status(503).json({ ok: false, error: 'database_unavailable' });

    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const result = await db.query(
      `SELECT id, user_id, filename, storage_key, url, content_type, size_bytes, created_at
       FROM files
       WHERE user_id=$1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [userId, limit]
    );

    return res.json({ ok: true, files: result.rows, count: result.rows.length });
  } catch (e) {
    console.error('[FILES] list failed:', e?.message);
    return res.status(500).json({ ok: false, error: 'list_failed', message: String(e?.message) });
  }
});

app.get('/api/memory', verifyJWT, async (req, res) => {
  try {
    const userId = String(req.user?.id || '').trim();
    if (!userId) return res.status(401).json({ ok: false, error: 'missing_user' });
    if (!db) return res.status(503).json({ ok: false, error: 'database_unavailable' });

    const [summary, facts, tasks, files] = await Promise.all([
      getLogicalUserMemory(userId),
      getUserFacts(userId, FACT_MEMORY_LIMIT),
      getUserTasks(userId, TASK_MEMORY_LIMIT),
      getUserFilesMemory(userId, FILE_MEMORY_LIMIT),
    ]);

    return res.json({
      ok: true,
      userId,
      memory: {
        summary,
        facts,
        tasks,
        files,
      },
      limits: {
        facts: FACT_MEMORY_LIMIT,
        tasks: TASK_MEMORY_LIMIT,
        files: FILE_MEMORY_LIMIT,
      }
    });
  } catch (e) {
    console.error('[MEMORY] read failed:', e?.message);
    return res.status(500).json({ ok: false, error: 'memory_read_failed', message: String(e?.message) });
  }
});

app.post('/api/memory/purge-now', verifyJWT, express.json(), async (req, res) => {
  try {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ ok: false, error: 'admin_required' });
    }

    const targetUserId = String(req.body?.userId || req.query.userId || req.user?.id || '').trim();
    const dryRunRaw = req.body?.dryRun ?? req.query?.dryRun;
    const dryRun = dryRunRaw === true || dryRunRaw === 'true' || dryRunRaw === '1' || dryRunRaw === 1;
    if (!targetUserId) {
      return res.status(400).json({ ok: false, error: 'missing_user_id' });
    }
    if (!db) return res.status(503).json({ ok: false, error: 'database_unavailable' });

    const before = await getStructuredMemoryCounts(targetUserId);
    let after = before;
    let removed = { facts: 0, tasks: 0, files: 0 };
    let wouldRemove = null;

    if (dryRun) {
      wouldRemove = await getStructuredMemoryPurgeCandidates(targetUserId);
    } else {
      await pruneStructuredMemory(targetUserId);
      after = await getStructuredMemoryCounts(targetUserId);
      removed = {
        facts: Math.max(0, before.facts - after.facts),
        tasks: Math.max(0, before.tasks - after.tasks),
        files: Math.max(0, before.files - after.files),
      };
    }

    return res.json({
      ok: true,
      userId: targetUserId,
      dryRun,
      purgeTriggeredAt: new Date().toISOString(),
      before,
      after,
      removed,
      wouldRemove,
    });
  } catch (e) {
    console.error('[MEMORY] purge-now failed:', e?.message);
    return res.status(500).json({ ok: false, error: 'memory_purge_failed', message: String(e?.message) });
  }
});

// ✅ PROTECTED CHAT ROUTE — /api/ai/chat (auth required via middleware)
// Centralized proxy with user context.
// If LOCAL_LLM_URL is set and provider is not explicit, default to provider=local
// so the unified proxy can target llama.cpp /completion.
app.post('/api/ai/chat', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    // req.user is available from Nezlephant middleware
    const user = req.user?.id || 'anonymous';
    console.log(`[A11][AuthChat] User ${user} calling /api/ai/chat`);

    // Forward to the canonical proxy with optional user context.
    const body = {
      ...req.body,
      _user: user  // Pass user context to LLM router for potential routing
    };

    if (!body.provider && (process.env.LOCAL_LLM_URL?.trim() || process.env.LLAMA_BASE?.trim() || getQflushChatFlow())) {
      body.provider = 'local';
    }

    req.body = body;
    return proxyChatToOpenAI(req, res);
  } catch (err) {
    console.error('[A11][AuthChat] Proxy error:', err?.message);
    res.status(502).json({
      ok: false,
      error: 'upstream_unreachable',
      message: String(err?.message)
    });
  }
});

// Serve system prompt for legacy frontend (public, no auth)
app.get('/api/system-prompt', (_req, res) => {
  try {
    const promptPath = path.join(__dirname, 'system_prompt.txt');
    if (!fs.existsSync(promptPath)) {
      return res.status(404).json({ ok: false, error: 'system_prompt_not_found' });
    }
    const text = fs.readFileSync(promptPath, 'utf8');
    return res.json({ ok: true, systemPrompt: text });
  } catch (err) {
    console.error('[A11] Failed to read system_prompt:', err?.message);
    return res.status(500).json({ ok: false, error: err?.message || 'read_error' });
  }
});

// Health check for Railway (expects /health)
app.get('/health', (_req, res) => res.send('OK'));

// Proxy /api/llm/stats to the configured LLM router (Cerbère) or DEFAULT_UPSTREAM
let __stats_cache = null;
let __stats_cache_ts = 0;
const STATS_CACHE_MS = Number(process.env.STATS_CACHE_MS) || 5000; // cache stats for 5s by default
let __last_probe_log = 0;

app.get('/api/llm/stats', async (req, res) => {
  try {
    const now = Date.now();
    // serve cached value if fresh
    if (__stats_cache && (now - __stats_cache_ts) < STATS_CACHE_MS) {
      // minimal log to indicate cached hit
      if (now - __last_probe_log > 60000) {
        console.log('[A11] /api/llm/stats - serving cached result');
        __last_probe_log = now;
      }
      return res.json(__stats_cache);
    }

    const upstreamHost = process.env.LLM_ROUTER_URL?.trim() || DEFAULT_UPSTREAM || 'http://127.0.0.1:4545';
    const probeUrl = String(upstreamHost).replace(/\/$/, '') + '/api/stats';
    console.log('[A11] Proxying /api/llm/stats ->', probeUrl);

    const r = await fetch(probeUrl, { method: 'GET' });
    if (!r.ok) {
      const txt = await r.text().catch(() => null);
      const payload = { ok: false, error: 'upstream_error', detail: txt };
      __stats_cache = payload; __stats_cache_ts = Date.now();
      return res.status(r.status).json(payload);
    }
    const json = await r.json().catch(() => null) || { ok: true };

    __stats_cache = json; __stats_cache_ts = Date.now();

    // --- MEMO AUTO: snapshot LLM stats ---
    try {
      saveMemo('llm_stats', {
        ts: Date.now(),
        stats: json
      });
    } catch (e) {
      console.warn('[A11][memo] llm_stats save failed:', e?.message);
    }
    // -------------------------------------

    return res.json(json);
  } catch (e) {
    console.error('[A11] /api/llm/stats proxy error:', e?.message);
    return res.status(502).json({ ok: false, error: 'upstream_unreachable', message: String(e?.message) });
  }
});

// Ajout helmet et cookieParser AVANT les routes
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());

// Serve frontend static files from the canonical web public folder only (not server/public_legacy)
const webPublic = path.resolve(__dirname, '..', 'web', 'dist');
try {
  const serveStatic = process.env.SERVE_STATIC?.toLowerCase() === 'true' || process.env.NODE_ENV === 'production';
  if (serveStatic) {
    if (fs.existsSync(webPublic)) {
      app.use(express.static(webPublic, { maxAge: '1d' }));
      console.log('[A11] Serving frontend static from', webPublic);
    } else {
      console.log('[A11] Frontend public folder not found at', webPublic);
    }
  } else {
    console.log('[A11] Skipping static middleware for web public (DEV mode or SERVE_STATIC!=true)');
  }
} catch (e) {
  console.warn('[A11] Could not initialize static middleware for web public:', e?.message);
}

// Serve legacy-prefixed URLs from the canonical web public folder as well
try {
  const serveLegacy = process.env.SERVE_STATIC?.toLowerCase() === 'true' || process.env.NODE_ENV === 'production';
  if (serveLegacy) {
    if (fs.existsSync(webPublic)) {
      app.use('/legacy', express.static(webPublic, { maxAge: '1d' }));
      console.log('[A11] Also serving web public under /legacy ->', webPublic);
    }
  } else {
    console.log('[A11] Skipping /legacy static middleware (DEV mode)');
  }
} catch (e) {
  console.warn('[A11] Could not initialize /legacy static middleware for web public:', e?.message);
}

// Ajout des routes /healthz et /
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get('/', (_req, res) => res.status(200).json({ ok: true, service: 'a11-api' }));

function getOpenAICompletionsUrl() {
  const base = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  return base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

function getLocalCompletionsUrl() {
  const base = String(process.env.LLAMA_BASE || '').trim();
  if (!base) return null;
  const normalized = base.replace(/\/$/, '');
  return normalized.endsWith('/v1') ? `${normalized}/chat/completions` : `${normalized}/v1/chat/completions`;
}

function getLocalLlamaCompletionUrl() {
  const base = String(process.env.LOCAL_LLM_URL || '').trim();
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/completion`;
}

function buildPromptFromMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return '';
  return messages
    .map((m) => (typeof m?.content === 'string' ? m.content : ''))
    .filter(Boolean)
    .join('\n');
}

function extractLocalCompletionContent(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.content === 'string') return payload.content;
  if (typeof payload.response === 'string') return payload.response;
  if (Array.isArray(payload.choices) && payload.choices[0]?.text) return String(payload.choices[0].text);
  return '';
}

function getCompletionsUrlForRequest(body) {
  const provider = String(body?.provider || '').trim().toLowerCase();
  if (provider === 'local') {
    return getLocalCompletionsUrl();
  }
  return getOpenAICompletionsUrl();
}

function getQflushChatFlow() {
  return String(process.env.QFLUSH_CHAT_FLOW || '').trim();
}

function getQflushMemorySummaryFlow() {
  return String(process.env.QFLUSH_MEMORY_SUMMARY_FLOW || DEFAULT_QFLUSH_MEMORY_SUMMARY_FLOW).trim();
}

function isBuiltInMemorySummaryFlow(flowName) {
  return String(flowName || '').trim() === DEFAULT_QFLUSH_MEMORY_SUMMARY_FLOW;
}

function getMemorySummaryProvider() {
  const configured = String(process.env.MEMORY_SUMMARY_PROVIDER || '').trim().toLowerCase();
  if (configured === 'openai' || configured === 'local') {
    return configured;
  }
  return getLocalLlamaCompletionUrl() || getLocalCompletionsUrl() ? 'local' : 'openai';
}

function shouldUseQflushChat(body) {
  const provider = String(body?.provider || '').trim().toLowerCase();
  const qflushChatFlow = getQflushChatFlow();
  const defaultUpstream = String(process.env.DEFAULT_UPSTREAM || '').trim().toLowerCase();

  if (provider === 'qflush') return true;
  if (!qflushChatFlow) return false;
  if (defaultUpstream === 'qflush') return true;

  const hasLocalLlama = !!getLocalLlamaCompletionUrl() || !!getLocalCompletionsUrl();
  return provider === 'local' && !hasLocalLlama;
}

function extractAssistantText(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload.output === 'string') return payload.output;
  if (typeof payload.response === 'string') return payload.response;
  if (typeof payload.content === 'string') return payload.content;
  if (typeof payload.text === 'string') return payload.text;
  if (payload.result && typeof payload.result === 'object') {
    return extractAssistantText(payload.result);
  }
  if (Array.isArray(payload.messages)) {
    const assistantMsg = [...payload.messages].reverse().find((msg) => msg?.role === 'assistant' && typeof msg.content === 'string');
    if (assistantMsg) return assistantMsg.content;
  }
  if (Array.isArray(payload.choices) && payload.choices[0]?.message?.content) {
    return String(payload.choices[0].message.content);
  }
  return '';
}

async function callChatBackend(messages, options = {}) {
  const provider = String(options.provider || getMemorySummaryProvider()).trim().toLowerCase();
  const model = String(options.model || process.env.MEMORY_SUMMARY_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();

  if (provider === 'local') {
    const localLlamaCompletionUrl = getLocalLlamaCompletionUrl();
    if (localLlamaCompletionUrl) {
      const prompt = buildPromptFromMessages(messages);
      const upstreamRes = await axios({
        method: 'post',
        url: localLlamaCompletionUrl,
        headers: { 'content-type': 'application/json' },
        data: {
          prompt,
          n_predict: Number(process.env.MEMORY_SUMMARY_MAX_TOKENS || 250),
          stream: false
        },
        timeout: 60000,
      });
      return extractLocalCompletionContent(upstreamRes.data).trim();
    }
  }

  const upstreamUrl = getCompletionsUrlForRequest({ provider: provider === 'local' ? 'local' : 'openai' });
  if (!upstreamUrl) {
    throw new Error('No upstream available for memory summary flow');
  }

  const upstreamRes = await axios({
    method: 'post',
    url: upstreamUrl,
    headers: buildOpenAIProxyHeaders({}, { provider }),
    data: {
      model,
      messages,
      stream: false,
      temperature: 0.2,
    },
    timeout: 60000,
  });

  return extractAssistantText(upstreamRes.data).trim();
}

async function runBuiltInLogicalMemorySummary(payload) {
  const previousSummary = String(payload?.previousSummary || '').trim();
  const latestUserMessage = String(payload?.latestUserMessage || '').trim();
  const recentMessages = Array.isArray(payload?.recentMessages) ? payload.recentMessages : [];

  const promptMessages = [
    {
      role: 'system',
      content: 'Tu mets a jour la memoire logique d\'un assistant. Resume uniquement les informations durables et utiles: identite, objectifs, preferences, contraintes, faits de vie, contexte emotionnel stable, besoins. Reste court, factuel, structure. N\'invente rien. Si une information n\'est pas durable ou utile, ignore-la.'
    },
    {
      role: 'user',
      content: [
        'Memoire actuelle:',
        previousSummary || '(vide)',
        '',
        'Historique recent:',
        recentMessages.map((msg) => `${msg.role}: ${msg.content}`).join('\n') || '(vide)',
        '',
        'Nouveau message utilisateur:',
        latestUserMessage,
        '',
        'Met a jour la memoire en quelques lignes courtes.'
      ].join('\n')
    }
  ];

  const summary = await callChatBackend(promptMessages, {
    provider: getMemorySummaryProvider(),
    model: process.env.MEMORY_SUMMARY_MODEL || undefined,
  });

  return { ok: true, output: summary };
}

async function runLogicalMemorySummaryFlow(payload = {}) {
  const flow = String(payload.flow || getQflushMemorySummaryFlow()).trim();
  if (isBuiltInMemorySummaryFlow(flow)) {
    return runBuiltInLogicalMemorySummary(payload);
  }
  return runQflushFlow(flow, payload);
}

function buildOpenAIProxyHeaders(reqHeaders, options = {}) {
  const provider = String(options.provider || '').trim().toLowerCase();
  const headers = reqHeaders ? { ...reqHeaders } : {};
  delete headers.host;
  headers['content-type'] = 'application/json';
  if (provider !== 'local' && !headers.authorization && process.env.OPENAI_API_KEY) {
    headers.authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  }
  return headers;
}

function appendChatTurnLogSafe(body, responsePayload, defaultModel) {
  try {
    const reqBody = body || {};
    const convId = reqBody.conversationId || reqBody.convId || reqBody.sessionId || 'default';
    const messages = Array.isArray(reqBody.messages) ? reqBody.messages : [];
    appendConversationLog({
      type: 'chat_turn',
      conversationId: convId,
      request: {
        model: reqBody.model || defaultModel,
        messages,
      },
      response: responsePayload,
    });
  } catch (e) {
    console.warn('[A11][memory] log chat_turn failed:', e?.message);
  }
}

async function loadUserMemoryContext(userId, latestUserMessage, conversationId) {
  const normalizedUserId = String(userId || '').trim();
  const normalizedLatestMessage = String(latestUserMessage || '').trim();
  const normalizedConversationId = normalizeConversationId(conversationId);

  if (!normalizedUserId) {
    return {
      storedMessages: [],
      logicalMemory: '',
      structuredFacts: [],
      structuredTasks: [],
      structuredFiles: [],
      structuredMemoryContext: '',
    };
  }

  if (normalizedLatestMessage) {
    await saveChatMemoryMessage(normalizedUserId, 'user', normalizedLatestMessage, normalizedConversationId);
    await saveStructuredMemoryFromMessage(normalizedUserId, normalizedLatestMessage);
  }

  const storedMessages = await getRecentChatMemory(normalizedUserId, CHAT_MEMORY_LIMIT, normalizedConversationId);
  let logicalMemory = await getLogicalUserMemory(normalizedUserId);
  const messageCount = await countUserMessages(normalizedUserId);

  if (shouldRefreshLogicalMemory(messageCount)) {
    const refreshed = await refreshLogicalUserMemory(normalizedUserId, normalizedLatestMessage, storedMessages);
    logicalMemory = refreshed || logicalMemory;
  }

  if (messageCount > 0 && messageCount % 25 === 0) {
    pruneChatMemory().catch((error_) => {
      console.warn('[DB] chat memory prune failed:', error_?.message);
    });
  }

  if (messageCount > 0 && messageCount % MEMORY_PURGE_EVERY_USER_MESSAGES === 0) {
    pruneStructuredMemory(normalizedUserId).catch((error_) => {
      console.warn('[DB] structured memory prune failed:', error_?.message);
    });
  }

  const [structuredFacts, structuredTasks, structuredFiles] = await Promise.all([
    getUserFacts(normalizedUserId, FACT_MEMORY_LIMIT),
    getUserTasks(normalizedUserId, TASK_MEMORY_LIMIT),
    getUserFilesMemory(normalizedUserId, FILE_MEMORY_LIMIT),
  ]);

  markFactsAsUsed(normalizedUserId, structuredFacts).catch((error_) => {
    console.warn('[DB] mark facts as used failed:', error_?.message);
  });

  return {
    storedMessages,
    logicalMemory,
    structuredFacts,
    structuredTasks,
    structuredFiles,
    structuredMemoryContext: buildStructuredMemoryContext({
      facts: structuredFacts,
      tasks: structuredTasks,
      files: structuredFiles,
    }),
  };
}

function buildQflushMessagesWithMemory(storedMessages, logicalMemory, structuredMemoryContext, systemPrompt) {
  const messages = [];
  const normalizedSystemPrompt = String(systemPrompt || '').trim();
  const systemMemoryParts = [];

  if (normalizedSystemPrompt) {
    messages.push({
      role: 'system',
      content: normalizedSystemPrompt
    });
  }

  if (logicalMemory) {
    systemMemoryParts.push(`Contexte utilisateur (memoire logique):\n${logicalMemory}`);
  }
  if (structuredMemoryContext) {
    systemMemoryParts.push(structuredMemoryContext);
  }

  if (systemMemoryParts.length) {
    messages.push({
      role: 'system',
      content: systemMemoryParts.join('\n\n')
    });
  }

  return [
    ...messages,
    ...(Array.isArray(storedMessages) ? storedMessages : [])
  ];
}

async function proxyQflushChat(req, res) {
  const qflushChatFlow = getQflushChatFlow();
  if (!qflushChatFlow) {
    return res.status(500).json({
      ok: false,
      error: 'missing_qflush_chat_flow',
      message: 'QFLUSH chat mode requires QFLUSH_CHAT_FLOW to be configured.'
    });
  }

  try {
    const body = req.body || {};
    const userId = String(req.user?.id || body._user || '').trim();
    const latestUserMessage = getLatestUserMessage(body);
    const conversationId = normalizeConversationId(body.conversationId || body.convId || body.sessionId);

    const memoryContext = await loadUserMemoryContext(userId, latestUserMessage, conversationId);
    const {
      storedMessages,
      logicalMemory,
      structuredFacts,
      structuredTasks,
      structuredFiles,
      structuredMemoryContext,
    } = memoryContext;

    const prompt = latestUserMessage || buildPromptFromMessages(storedMessages);
    const qflushMessages = buildQflushMessagesWithMemory(
      storedMessages,
      logicalMemory,
      structuredMemoryContext,
      body.systemPrompt
    );

    console.log('[A11] USING QFLUSH flow ->', qflushChatFlow);
    const qflushResult = await runQflushFlow(qflushChatFlow, {
      prompt,
      messages: qflushMessages,
      model: body.model,
      systemPrompt: body.systemPrompt,
      logicalMemory,
      structuredMemory: {
        facts: structuredFacts,
        tasks: structuredTasks,
        files: structuredFiles,
        contextOnly: true,
      },
      chatHistoryLimit: CHAT_MEMORY_LIMIT,
      userId: userId || null,
      user: req.user || null,
      request: body
    });

    const content = extractAssistantText(qflushResult);
    if (userId && content) {
      await saveChatMemoryMessage(userId, 'assistant', content, conversationId);
    }

    const data = {
      id: `chatcmpl-qflush-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model || 'qflush',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: 'stop',
        },
      ],
      memory: {
        userId: userId || null,
        historyCount: storedMessages.length,
        logicalSummary: logicalMemory || null,
        factsCount: structuredFacts.length,
        tasksCount: structuredTasks.length,
        filesCount: structuredFiles.length,
        historyLimit: CHAT_MEMORY_LIMIT,
      },
      qflush: qflushResult,
    };

    appendChatTurnLogSafe(body, data, 'qflush');
    return res.status(200).json(data);
  } catch (err) {
    console.error('[A11] Error proxying chat via QFLUSH:', err && (err.message || err.toString()));
    return res.status(502).json({ ok: false, error: 'qflush_unreachable', message: String(err?.message) });
  }
}

async function proxyLocalLlamaCompletion(req, res, localLlamaCompletionUrl) {
  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const prompt = typeof body.prompt === 'string' && body.prompt.trim()
      ? body.prompt
      : buildPromptFromMessages(messages);
    const nPredictRaw = body.n_predict ?? body.max_tokens ?? 200;
    const nPredict = Number.isFinite(Number(nPredictRaw)) ? Number(nPredictRaw) : 200;

    const userInfo = req.user?.username ? `(user: ${req.user.username})` : '';
    console.log('[A11][Llama] Proxying local completion', userInfo, '->', localLlamaCompletionUrl);
    const upstreamRes = await axios({
      method: 'post',
      url: localLlamaCompletionUrl,
      headers: { 'content-type': 'application/json' },
      data: {
        prompt,
        n_predict: nPredict,
        stream: false
      },
      timeout: 60000,
    });

    const content = extractLocalCompletionContent(upstreamRes.data);
    const data = {
      id: `chatcmpl-local-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model || 'local-gguf',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: 'stop',
        },
      ],
    };

    appendChatTurnLogSafe(body, data, 'local-gguf');
    return res.status(200).json(data);
  } catch (err) {
    console.error('[A11] Error proxying local llama.cpp completion ->', localLlamaCompletionUrl, err && (err.message || err.toString()));
    if (err.response?.data) {
      return res.status(err.response.status || 502).json(err.response.data);
    }
    return res.status(502).json({ ok: false, error: 'upstream_unreachable', message: String(err?.message) });
  }
}

async function proxyChatToOpenAI(req, res) {
  const provider = String(req.body?.provider || '').trim().toLowerCase();

  if (shouldUseQflushChat(req.body)) {
    return proxyQflushChat(req, res);
  }

  const localLlamaCompletionUrl = provider === 'local' ? getLocalLlamaCompletionUrl() : null;

  if (localLlamaCompletionUrl) {
    console.log('[A11] USING LOCAL_LLM_URL ->', localLlamaCompletionUrl);
    return proxyLocalLlamaCompletion(req, res, localLlamaCompletionUrl);
  }

  const upstreamUrl = getCompletionsUrlForRequest(req.body);
  if (!upstreamUrl) {
    return res.status(500).json({
      ok: false,
      error: 'missing_local_upstream',
      message: 'provider=local requires LOCAL_LLM_URL or LLAMA_BASE, or enable QFLUSH chat with QFLUSH_CHAT_FLOW.'
    });
  }
  console.log('[A11] USING', provider === 'local' ? 'LLAMA_BASE' : 'OPENAI', '->', upstreamUrl);

  try {
    const upstreamRes = await axios({
      method: 'post',
      url: upstreamUrl,
      headers: buildOpenAIProxyHeaders(req.headers, { provider }),
      data: req.body && Object.keys(req.body).length ? req.body : undefined,
      timeout: 60000,
    });

    const data = upstreamRes.data;

    appendChatTurnLogSafe(req.body, data, 'gpt-4o-mini');

    return res.status(upstreamRes.status).json(data);
  } catch (err) {
    console.error('[A11] Error proxying chat ->', upstreamUrl, err && (err.message || err.toString()));
    if (err.response?.data) {
      return res.status(err.response.status || 502).json(err.response.data);
    }
    return res.status(502).json({ ok: false, error: 'upstream_unreachable', message: String(err?.message) });
  }
}

// Canonical OpenAI-like route
app.post('/v1/chat/completions', proxyChatToOpenAI);

// Existing frontend route
app.post('/api/llm/chat', proxyChatToOpenAI);

// Compatibility aliases used by older frontend builds — ensure provider defaults to 'local' if available
app.post('/api/ai', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    if (!req.body) req.body = {};
    if (!req.body.provider && (process.env.LOCAL_LLM_URL?.trim() || process.env.LLAMA_BASE?.trim() || getQflushChatFlow())) {
      req.body.provider = 'local';
    }
    return proxyChatToOpenAI(req, res);
  } catch (err) {
    console.error('[A11][/api/ai] Error:', err?.message);
    return res.status(502).json({ ok: false, error: 'proxy_error', message: String(err?.message) });
  }
});

app.post('/api/completions', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    if (!req.body) req.body = {};
    if (!req.body.provider && (process.env.LOCAL_LLM_URL?.trim() || process.env.LLAMA_BASE?.trim() || getQflushChatFlow())) {
      req.body.provider = 'local';
    }
    return proxyChatToOpenAI(req, res);
  } catch (err) {
    console.error('[A11][/api/completions] Error:', err?.message);
    return res.status(502).json({ ok: false, error: 'proxy_error', message: String(err?.message) });
  }
});

// helper to collect stream into buffer
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(Buffer.from(c)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (e) => reject(e));
  });
}

// Global runtime flags and port (single source of truth)
let LISTENING = false;
if (globalThis.__A11_PORT === undefined) {
  globalThis.__A11_PORT = Number(process.env.PORT) || 3000;
}
const PORT = globalThis.__A11_PORT;
console.log(`[A11] PORT utilisé: ${ PORT } (source: ${ envSource }, env: ${ process.env.PORT || 'non défini'})`);

// Single DEFAULT_UPSTREAM: prefer LLAMA_BASE if set, otherwise use localhost (11434)
if (globalThis.__A11_DEFAULT_UPSTREAM === undefined) {
  const host = '127.0.0.1';
  // default to llama-server port 8000 when LLAMA_BASE is not set
  const port = process.env.LLAMA_PORT || '8000';
  const configuredLlmBase = process.env.LLAMA_BASE?.trim();
  // If a local LLM router is configured, prefer it as the default upstream
  if (process.env.LLM_ROUTER_URL?.trim()) {
    globalThis.__A11_DEFAULT_UPSTREAM = process.env.LLM_ROUTER_URL.trim();
    console.log('[Alpha Onze] Using LLM router as DEFAULT_UPSTREAM =', globalThis.__A11_DEFAULT_UPSTREAM);
  } else {
    globalThis.__A11_DEFAULT_UPSTREAM = configuredLlmBase || `http://${host}:${port}`;
  }
}
const DEFAULT_UPSTREAM = globalThis.__A11_DEFAULT_UPSTREAM;

// Determine backend mode from environment. Defaults to 'local' for LLaMA usage.
// Expose configured backend and LLAMA_BASE for diagnostics.
const LLAMA_BASE_ENV = process.env.LLAMA_BASE?.trim();
const RAW_BACKEND = String(process.env.BACKEND || '').trim().toLowerCase();
const BACKEND = (LLAMA_BASE_ENV ? 'local' : (RAW_BACKEND || 'local'));
if (LLAMA_BASE_ENV && RAW_BACKEND !== 'local') {
    console.log(`[Alpha Onze] Notice: LLAMA_BASE is set -> forcing BACKEND='local' (was '${RAW_BACKEND || 'unset'}').`);
}

// Intégration automatique des modules power1, power2, power3
let power1, power2, power3;
try {
  power1 = require('./dist/a11/power1');
} catch (e) {
  console.warn('[A11] power1 non chargé:', e?.message);
}
try {
  power2 = require('./dist/a11/power2');
} catch (e) {
  console.warn('[A11] power2 non chargé:', e?.message);
}
try {
  power3 = require('./dist/a11/power3');
} catch (e) {
  console.warn('[A11] power3 non chargé:', e?.message);
}
globalThis.power1 = power1;
globalThis.power2 = power2;
globalThis.power3 = power3;

// Ajout des routes pour le pont QFlush et l'agent A-11
const { runQflushTool } = require("./lib/qflushTools");
const { callA11AgentLLM } = require("./lib/a11Agent"); // à créer ou adapter

app.use(express.json());

app.get('/api/qflush/status', (req, res) => {
  if (!QFLUSH_AVAILABLE) {
    return res.json({ available: false, message: 'QFlush not available' });
  }

  try {
    const supervisor = globalThis.__A11_QFLUSH_SUPERVISOR || globalThis.__A11_SUPERVISOR;
    if (!supervisor) {
      return res.json({
        available: true,
        initialized: false,
        remoteUrl: process.env.QFLUSH_REMOTE_URL || process.env.QFLUSH_URL || null,
        chatFlow: getQflushChatFlow() || null,
        memorySummaryFlow: getQflushMemorySummaryFlow(),
        memorySummaryBuiltIn: isBuiltInMemorySummaryFlow(getQflushMemorySummaryFlow()),
        message: 'Supervisor not initialized'
      });
    }

    const status = qflushIntegration.getStatus(supervisor);
    return res.json({
      available: true,
      initialized: true,
      remoteUrl: process.env.QFLUSH_REMOTE_URL || process.env.QFLUSH_URL || null,
      chatFlow: getQflushChatFlow() || null,
      memorySummaryFlow: getQflushMemorySummaryFlow(),
      memorySummaryBuiltIn: isBuiltInMemorySummaryFlow(getQflushMemorySummaryFlow()),
      ...status
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/tools/run", async (req, res) => {
  try {
    const { tool, input } = req.body || {};
    if (!tool) {
      return res.status(400).json({ ok: false, error: "Missing 'tool' field" });
    }
    const result = await runQflushTool(tool, input || {});
    res.json(result);
  } catch ( e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

// Nouveau endpoint IA avec Qflush
app.post('/ai', async (req, res) => {
  try {
    const { input, mode, flow } = req.body || {};
    if (!input) {
      return res.status(400).json({ error: 'Missing input' });
    }

    let output;
    if (mode === 'qflush') {
      const effectiveFlow = String(flow || getQflushChatFlow() || '').trim();
      if (!effectiveFlow) {
        return res.status(500).json({
          error: 'Missing QFLUSH flow',
          message: 'Set QFLUSH_CHAT_FLOW or pass { mode: "qflush", flow: "..." }.'
        });
      }
      const result = await runQflushFlow(effectiveFlow, { input, prompt: input, request: req.body || {} });
      output = extractAssistantText(result) || JSON.stringify(result);
    } else {
      // Mode LLM : proxy vers le LLM router
      const upstreamHost = process.env.LLM_ROUTER_URL?.trim() || DEFAULT_UPSTREAM;
      const upstreamUrl = String(upstreamHost).replace(/\/$/, '') + '/v1/chat/completions';

      const upstreamRes = await axios.post(upstreamUrl, {
        model: 'llama3.2:latest',
        messages: [{ role: 'user', content: input }],
        stream: false
      }, { timeout: 60000 });

      output = upstreamRes.data.choices?.[0]?.message?.content || 'Réponse LLM vide';
    }

    res.json({ output });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const { A11_AGENT_SYSTEM_PROMPT, A11_AGENT_DEV_PROMPT } = require('./lib/a11Agent.js');
const { runAction } = require('./src/a11/tools-dispatcher.cjs');

async function callA11LLM(messages) {
  const backend = BACKENDS.llama_local;
  const upstreamUrl = `${backend.replace(/\/$/, '')}/v1/chat/completions`;
  const body = {
    model: 'llama3.2:latest',
    messages: [
      { role: 'system', content: A11_AGENT_SYSTEM_PROMPT },
      { role: 'system', content: A11_AGENT_DEV_PROMPT },
      ...messages
    ],
    stream: false
  };
  const res = await fetch(upstreamUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`A11 LLM error: ${res.status} – ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.delta?.content ?? '';
  return content.toString().trim();
}

// --- Helpers Cerbère -> A-11 ---
function summarizeCerbereResults(cerbere) {
  try {
    if (!cerbere) return 'Actions exécutées par Cerbère.';
    let actions = [];
    if (Array.isArray(cerbere.results)) {
      actions = cerbere.results;
    } else if (Array.isArray(cerbere.actions)) {
      actions = cerbere.actions;
    }
    const parts = actions.map((a) => {
      const ok = a?.result?.ok ?? a?.ok;
      const tool = a?.name || a?.tool || 'action';
      const status = ok ? 'ok' : 'erreur';
      return `• ${tool} → ${status}`;
    });
    if (!parts.length) return 'Actions exécutées par Cerbère.';
    return ['Actions exécutées par Cerbère :', ...parts].join('\n');
  } catch {
    return 'Actions exécutées par Cerbère.';
  }
}

function extractImagePathFromCerbere(cerbere) {
  let actions = [];
  if (Array.isArray(cerbere?.results)) {
    actions = cerbere.results;
  } else if (Array.isArray(cerbere?.actions)) {
    actions = cerbere.actions;
  }
  for (const a of actions) {
    const tool = a?.name || a?.tool;
    const r = a?.result || {};
    const p = r.outputPath || r.path || r.savedAs || r.filePath;
    if (tool === 'download_file' && typeof p === 'string' && p.length > 0) {
      return p;
    }
  }
  return null;
}

app.post('/api/agent', express.json(), async (req, res) => {
  try {
    const { envelope } = req.body || {};
    if (!envelope) {
      return res.status(400).json({
        ok: false,
        error: 'Missing "envelope" in request body'
      });
    }

    // 1) Exécution des actions par Cerbère
    const cerbere = await runActionsEnvelope(envelope);

    // 2) Résumé texte
    let explanation = summarizeCerbereResults(cerbere);

    // 3) Extraction éventuelle d’un chemin d’image
    const relativeImagePath = extractImagePathFromCerbere(cerbere); // ex: "docs/camembert.jpg"
    let publicImageUrl = null;

    if (relativeImagePath) {
      // chemin absolu sur disque pour info/log
      const absPath = path.isAbsolute(relativeImagePath)
        ? relativeImagePath
        : path.join(WORKSPACE_ROOT, relativeImagePath);

      // chemin relatif par rapport au workspace pour /files
      const relFromRoot = path.relative(WORKSPACE_ROOT, absPath).replaceAll('\\', '/');
      publicImageUrl = `/files/${relFromRoot}`;

      // On enrichit le message avec le markdown de l’image
      explanation += `\n\nVoici l'image téléchargée :\n\n![image](${publicImageUrl})`;
    }

    // --- MEMOIRE: log de l'action agent ---
    try {
      appendConversationLog({
        type: 'agent_actions',
        conversationId: envelope.conversationId || 'dev-agent',
        envelope,
        explanation,
        imagePath: publicImageUrl,
        cerbere
      });
    } catch (e) {
      console.warn('[A11][memory] log agent_actions failed:', e?.message);
    }
    // ---------------------------------------

    return res.json({
      ok: true,
      mode: 'dev',
      explanation,
      imagePath: publicImageUrl,
      cerbere
    });
  } catch (e) {
    console.error('[A11][agent] error:', e);
    return res.status(500).json({
      ok: false,
      error: String(e?.message)
    });
  }
});

// ─────────────────────────────────────────────
// API: lecture de la mémoire des conversations
// ─────────────────────────────────────────────
app.get('/api/a11/memory/conversations', (req, res) => {
  try {
    ensureConvDir();

    // Si le dossier n'existe toujours pas → pas d'erreur, juste vide
    if (!fsMem.existsSync(A11_CONV_DIR)) {
      return res.json({ ok: true, entries: [] });
    }

    const files = fsMem
      .readdirSync(A11_CONV_DIR, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.jsonl'))
      .map((d) => d.name);

    const entries = [];

    for (const f of files) {
      const full = pathMem.join(A11_CONV_DIR, f);
      let raw;
      try {
        raw = fsMem.readFileSync(full, 'utf8');
      } catch (e) {
        console.warn('[A11][memory] read file failed:', full, e?.message);
        continue;
      }
      const lines = raw.split('\n').map((x) => x.trim()).filter(Boolean);
      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch (e) {
          console.warn('[A11][memory] JSON parse error in', full, e?.message);
        }
      }
    }

    entries.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));

    res.json({ ok: true, entries });
  } catch ( e) {
    console.error('[A11][memory] read failed:', e?.message);
    res.status(500).json({ ok: false, error: String(e?.message) });
  }
});
/// --- Fin API mémoire ---

// --- MEMO API: créer un mémo ---
app.post('/api/a11/memo', express.json(), (req, res) => {
  const { type, data } = req.body || {};

  if (!type || data === undefined) {
    return res.status(400).json({ ok: false, error: 'Missing type or data' });
  }

  const entry = saveMemo(type, data);
  if (!entry) {
    return res.status(500).json({ ok: false, error: 'Failed to save memo' });
  }

  return res.json({ ok: true, memo: entry });
});

// --- MEMO API: récupérer tous les mémos ---
app.get('/api/a11/memo/all', (req, res) => {
  const entries = loadAllMemos();
  return res.json({ ok: true, entries });
});

// --- MEMO API: récupérer un mémo complet par ID ---
app.get('/api/a11/memo/:id', (req, res) => {
  const id = req.params.id;
  const file = path.join(A11_MEMO_DIR, `${id}.json`);

  if (!fs.existsSync(file)) {
    return res.status(404).json({ ok: false, error: 'Memo not found' });
  }

  try {
    const raw = fs.readFileSync(file, 'utf8');
    const memo = JSON.parse(raw);
    return res.json({ ok: true, memo });
  } catch (e) {
    console.error('[A11][memo] read memo failed:', e?.message);
    return res.status(500).json({ ok: false, error: e?.message });
  }
});

// --- MEMOS AUTO: snapshot au démarrage ---
function snapshotOnStartup() {
  try {
    const safeEnv = {};
    const keys = [
      'NODE_ENV',
      'BACKEND',
      'LLAMA_BASE',
      'LLAMA_PORT',
      'LLM_ROUTER_URL',
      'PORT',
      'HOST_SERVER'
    ];
    for (const k of keys) {
      if (process.env[k] !== undefined) safeEnv[k] = process.env[k];
    }

    const qflushInfo = {
      available: !!globalThis.__QFLUSH_AVAILABLE,
      module: !!globalThis.__QFLUSH_MODULE,
      exePath: globalThis.__QFLUSH_PATH || null
    };

    saveMemo('env_snapshot', {
      ts: Date.now(),
      env: safeEnv,
      qflush: qflushInfo
    });
    console.log('[A11][memo] env_snapshot saved on startup');
  } catch (e) {
    console.warn('[A11][memo] env_snapshot failed:', e?.message);
  }
}
snapshotOnStartup();

// Ajout de la route POST /api/a11/memo/snapshot/qflush pour snapshot QFlush à la demande dans server.cjs.
app.post('/api/a11/memo/snapshot/qflush', async (req, res) => {
  try {
    const info = {
      available: !!globalThis.__QFLUSH_AVAILABLE,
      exePath: globalThis.__QFLUSH_PATH || null,
      module: !!globalThis.__QFLUSH_MODULE
    };
    const entry = saveMemo('qflush_snapshot', info);
    if (!entry) {
      return res.status(500).json({ ok: false, error: 'saveMemo failed' });
    }
    return res.json({ ok: true, memo: entry });
  } catch ( e) {
    console.error('[A11][memo] qflush snapshot failed:', e?.message);
    return res.status(500).json({ ok: false, error: e?.message });
  }
});

// --- Mémoire persistante A-11 : key/value ---
const A11_MEMORY_KV_FILE = pathMem.join(A11_MEMORY_ROOT, 'memory.json');

function writeMemoryKeyValue(key, value) {
  try {
    ensureMemoDir(); // pour créer le dossier si besoin
    let data = {};
    if (fsMem.existsSync(A11_MEMORY_KV_FILE)) {
      try {
        data = JSON.parse(fsMem.readFileSync(A11_MEMORY_KV_FILE, 'utf8'));
      } catch {}
    }
    data[key] = value;
    fsMem.writeFileSync(A11_MEMORY_KV_FILE, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, key, value };
  } catch (e) {
    return { ok: false, error: e?.message };
  }
}

// --- Route API pour a11_memory_write ---
app.post('/api/a11/memory/write', express.json(), (req, res) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ ok: false, error: 'Missing key' });
  const result = writeMemoryKeyValue(key, value);
  if (!result.ok) return res.status(500).json(result);
  return res.json(result);
});

// Ajout du routeur d'historique des conversations A-11
const a11HistoryRouter = require('./routes/a11-history.cjs');
app.use(a11HistoryRouter);

// Ajout du routeur Cerbère (llm-router.cjs)
const llmRouter = require('./llm-router.cjs');
app.use(llmRouter);

// Fallback: ensure server starts
if (!LISTENING) {
  try {
    app.listen(PORT, '0.0.0.0', () => {
      LISTENING = true;
      console.log(`[A11] Server listening on http://0.0.0.0:${PORT}`);
    });
  } catch (e) {
    console.error('[A11] Failed to start server:', e?.message);
    process.exit(1);
  }
}
