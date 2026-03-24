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
const crypto = require('crypto');
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
    const { setupA11Supervisor } = require('./src/qflush-integration.cjs');
    setupA11Supervisor().then((supervisor) => {
      if (supervisor) {
        console.log('[Supervisor] A11 supervisor initialized');
        globalThis.__A11_SUPERVISOR = supervisor;
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

if (db) {
  db.connect()
    .then(async (client) => {
      client.release();
      console.log('[DB] ✅ PostgreSQL connecté');
      try {
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT');
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP');
        console.log('[DB] ✅ users.reset_token columns vérifiées');
      } catch (schemaErr) {
        console.warn('[DB] ⚠️ Migration reset token non appliquée:', schemaErr.message);
      }
    })
    .catch(e => console.error('[DB] ❌ Connexion PostgreSQL échouée:', e.message));
} else {
  console.warn('[DB] DATABASE_URL non défini, authentification DB désactivée');
}

// ============================================================
// Email providers
// Priority: Resend API, then SMTP/Gmail fallback
// ============================================================
const resendApiKey = String(process.env.RESEND_API_KEY || '').trim();
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

const hasSmtpConfig = !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
const hasGmailConfig = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

const emailTransporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
  : hasGmailConfig
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      })
    : null;

if (resendClient) {
  console.log('[MAIL] ✅ Resend provider activé');
}

if (!resendClient && !emailTransporter) {
  console.warn('[MAIL] Aucun provider mail configuré (RESEND_API_KEY ou SMTP_* ou EMAIL_*)');
} else {
  if (emailTransporter) {
    emailTransporter.verify()
      .then(() => console.log('[MAIL] ✅ Transport SMTP prêt'))
      .catch((e) => console.error('[MAIL] ❌ Transport SMTP invalide:', e.message));
  }
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
    if (u === 'admin' && p === '1234') {
      const token = jwt.sign({ username: 'admin', id: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
      return res.json({ success: true, token, user: { id: 'admin', username: 'admin' } });
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

    const appUrl = (process.env.APP_URL || process.env.FRONT_URL || 'https://a11.funesterie.pro').replace(/\/$/, '');
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
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const hash = await bcrypt.hash(password, 10);

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

// ✅ AUTH MIDDLEWARE - appliqué SEULEMENT sur /api/ai pour protéger chat
// /api/auth/login reste public!
app.use('/api/ai', verifyJWT);

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

    if (!body.provider && process.env.LOCAL_LLM_URL?.trim()) {
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
  const base = String(process.env.QFLUSH_URL || process.env.QFLUSH_REMOTE_URL || process.env.LLAMA_BASE || '').trim();
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
  const localLlamaCompletionUrl = provider === 'local' ? getLocalLlamaCompletionUrl() : null;

  if (localLlamaCompletionUrl) {
    return proxyLocalLlamaCompletion(req, res, localLlamaCompletionUrl);
  }

  const upstreamUrl = getCompletionsUrlForRequest(req.body);
  if (!upstreamUrl) {
    return res.status(500).json({
      ok: false,
      error: 'missing_local_upstream',
      message: 'provider=local requires LOCAL_LLM_URL (or QFLUSH_URL / QFLUSH_REMOTE_URL / LLAMA_BASE)'
    });
  }
  console.log('[A11] Proxying chat ->', upstreamUrl, `(provider=${provider || 'openai'})`);

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
    if (!req.body.provider && process.env.LOCAL_LLM_URL?.trim()) {
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
    if (!req.body.provider && process.env.LOCAL_LLM_URL?.trim()) {
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
  const configuredLlmBase = process.env.LLAMA_BASE?.trim() || process.env.QFLUSH_URL?.trim() || process.env.QFLUSH_REMOTE_URL?.trim();
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
const LLAMA_BASE_ENV = process.env.LLAMA_BASE?.trim() || process.env.QFLUSH_URL?.trim() || process.env.QFLUSH_REMOTE_URL?.trim();
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
    const { input, mode } = req.body || {};
    if (!input) {
      return res.status(400).json({ error: 'Missing input' });
    }

    let output;
    if (mode === 'qflush') {
      // Mode Qflush : utiliser l'orchestrateur
      const qflush = (await import('@funeste38/qflush')).default;
      output = qflush.process(input);
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
