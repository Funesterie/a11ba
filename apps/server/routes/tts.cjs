const path = require('node:path');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const express = require('express');
const router = express.Router();

const commandAvailabilityCache = new Map();

function envBool(name, fallback = false) {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function isCommandAvailable(command) {
  const key = String(command || '').trim();
  if (!key) return false;
  if (commandAvailabilityCache.has(key)) return commandAvailabilityCache.get(key);

  const checker = process.platform === 'win32' ? 'where' : 'which';
  const probe = spawnSync(checker, [key], { stdio: 'ignore' });
  const ok = probe.status === 0;
  commandAvailabilityCache.set(key, ok);
  return ok;
}

function parseHttpUrl(value, fallback) {
  const input = String(value || '').trim();
  if (!input) return fallback;
  try {
    return new URL(input.includes('://') ? input : `http://${input}`);
  } catch {
    return fallback;
  }
}

function getLocalTtsConfig() {
  const fallback = new URL('http://127.0.0.1:5002');
  const baseUrl = parseHttpUrl(process.env.TTS_BASE_URL, null);
  const hostUrl = parseHttpUrl(process.env.TTS_HOST, null);

  const selected = baseUrl || hostUrl || fallback;
  const hostname = selected.hostname || '127.0.0.1';
  const selectedPort = Number(process.env.TTS_PORT || selected.port || 5002);
  const port = Number.isFinite(selectedPort) && selectedPort > 0 ? selectedPort : 5002;

  return {
    host: hostname,
    port,
    baseUrl: `${selected.protocol}//${hostname}:${port}`,
  };
}

function getWorkspaceRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function getPublicTtsDir() {
  return path.join(getWorkspaceRoot(), 'public', 'tts');
}

function ensurePublicTtsDir() {
  const ttsDir = getPublicTtsDir();
  fs.mkdirSync(ttsDir, { recursive: true });
  return ttsDir;
}

function resolvePiperBinary() {
  const workspaceRoot = getWorkspaceRoot();
  const configured = String(process.env.PIPER_BIN || process.env.PIPER_EXE || '').trim();
  const candidates = [
    configured,
    path.join(workspaceRoot, 'piper', 'piper.exe'),
    path.join(workspaceRoot, 'piper', 'piper'),
    'piper'
  ].filter(Boolean);

  for (const candidate of candidates) {
    // Command name on PATH (for example "piper")
    if (!candidate.includes(path.sep) && !candidate.includes('/')) {
      if (isCommandAvailable(candidate)) {
        return { command: candidate, cwd: workspaceRoot };
      }
      continue;
    }

    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) {
      return { command: resolved, cwd: path.dirname(resolved) };
    }
  }

  return null;
}

function resolvePiperModel(requestedModel) {
  const workspaceRoot = getWorkspaceRoot();
  const explicitModelPath = String(process.env.TTS_MODEL_PATH || process.env.PIPER_MODEL_PATH || '').trim();
  const modelsDirEnv = String(process.env.TTS_MODELS_DIR || process.env.PIPER_MODELS_DIR || '').trim();

  function addModelCandidate(target, value) {
    const raw = String(value || '').trim();
    if (!raw) return;
    if (!target.includes(raw)) target.push(raw);
    if (!raw.toLowerCase().endsWith('.onnx')) {
      const withExt = `${raw}.onnx`;
      if (!target.includes(withExt)) target.push(withExt);
    }
  }

  const modelCandidates = [];
  addModelCandidate(modelCandidates, requestedModel);
  addModelCandidate(modelCandidates, explicitModelPath);
  // Prefer SIWIS when no explicit model is requested.
  addModelCandidate(modelCandidates, 'fr_FR-siwis-medium');
  addModelCandidate(modelCandidates, 'fr_FR-medium');

  const baseDirs = [
    modelsDirEnv,
    path.join(workspaceRoot, 'apps', 'server', 'tts'),
    path.join(workspaceRoot, 'apps', 'tts'),
    path.join(workspaceRoot, 'piper', 'models'),
    path.join(workspaceRoot, 'tts'),
    '/app/apps/server/tts',
    '/app/apps/tts',
    '/app/tts',
    '/data/tts'
  ].filter(Boolean);

  for (const candidate of modelCandidates) {
    if (!candidate) continue;

    const looksAbsolute = path.isAbsolute(candidate) || /^[A-Za-z]:\\/.test(candidate);
    if (looksAbsolute && fs.existsSync(candidate)) {
      return candidate;
    }

    for (const dir of baseDirs) {
      const modelPath = path.join(dir, candidate);
      if (fs.existsSync(modelPath)) {
        return modelPath;
      }
    }
  }

  return null;
}

function ensurePiperModelSidecars(modelPath) {
  const resolvedModelPath = String(modelPath || '').trim();
  if (!resolvedModelPath || !fs.existsSync(resolvedModelPath)) {
    return { modelJsonPath: null, modelJsonExists: false };
  }

  const preferred = `${resolvedModelPath}.json`;
  const legacy = resolvedModelPath.replace(/\.onnx$/i, '.json');
  const existing = [preferred, legacy].find((candidate) => fs.existsSync(candidate)) || null;

  if (fs.existsSync(preferred) && fs.existsSync(legacy)) {
    return { modelJsonPath: preferred, modelJsonExists: true };
  }

  if (existing) {
    const missing = preferred === existing ? legacy : preferred;
    try {
      fs.copyFileSync(existing, missing);
    } catch (error_) {
      console.warn('[TTS][Piper] failed to mirror model sidecar:', error_.message);
    }
    return {
      modelJsonPath: fs.existsSync(preferred) ? preferred : existing,
      modelJsonExists: fs.existsSync(preferred) || fs.existsSync(legacy),
    };
  }

  return { modelJsonPath: null, modelJsonExists: false };
}

function getSpawnReadiness(requestedModel) {
  const piper = resolvePiperBinary();
  const modelPath = resolvePiperModel(requestedModel);
  const modelJsonCandidates = modelPath
    ? [
        `${modelPath}.json`,
        modelPath.replace(/\.onnx$/i, '.json'),
      ]
    : [];
  const ensuredSidecar = ensurePiperModelSidecars(modelPath);
  const modelJsonPath = ensuredSidecar.modelJsonPath || modelJsonCandidates.find((candidate) => fs.existsSync(candidate)) || null;
  const modelJsonExists = ensuredSidecar.modelJsonExists || Boolean(modelJsonPath);
  return {
    ready: Boolean(piper && modelPath && modelJsonExists),
    piperCommand: piper?.command || null,
    modelPath: modelPath || null,
    requestedModel: requestedModel || null,
    modelJsonCandidates,
    modelJsonPath,
    modelJsonExists,
  };
}

function listOnnxFiles(modelsDir) {
  const results = [];
  function walk(dir, relative = '') {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const it of items) {
      const rel = path.join(relative, it.name);
      const full = path.join(dir, it.name);
      if (it.isDirectory()) {
        walk(full, rel);
      } else if (it.isFile() && it.name.toLowerCase().endsWith('.onnx')) {
        results.push(rel.replaceAll('\\', '/'));
      }
    }
  }
  try {
    walk(modelsDir);
  } catch {
    return [];
  }
  return results;
}

function parseJsonMaybe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toPublicAudioUrl(value) {
  const audioUrl = String(value || '').trim();
  if (!audioUrl) return null;
  return audioUrl.startsWith('/tts/') ? audioUrl : '/tts/' + path.basename(audioUrl);
}

async function requestRemoteTts(payload) {
  const ttsBaseUrl = String(process.env.TTS_BASE_URL || getLocalTtsConfig().baseUrl).replace(/\/$/, '');
  const response = await fetch(`${ttsBaseUrl}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const textBody = await response.text();
  const parsed = parseJsonMaybe(textBody);

  if (typeof parsed === 'string' && parsed.endsWith('.wav')) {
    return { audio_url: toPublicAudioUrl(parsed), via: 'http-string' };
  }

  const audioUrl = parsed?.audio_url || parsed?.audioUrl || parsed?.url || parsed?.path || parsed?.file || parsed?.wav || null;
  if (!audioUrl) {
    throw new Error(`invalid_http_tts_response: ${String(textBody).slice(0, 300)}`);
  }

  return {
    audio_url: toPublicAudioUrl(audioUrl),
    via: 'http',
  };
}

async function probePiperHttpHealth(baseUrl, enabled) {
  const candidates = ['/health', '/api/tts', '/', '/synthesize', '/tts'];
  let lastHttpStatus = null;
  let lastBody = '';
  let lastError = null;

  if (!enabled) {
    return {
      ok: false,
      statusCode: null,
      path: null,
      body: null,
      lastHttpStatus,
      lastBody,
      lastError,
    };
  }

  for (const candidatePath of candidates) {
    try {
      const response = await fetch(`${baseUrl}${candidatePath}`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      const raw = await response.text();
      if (response.ok) {
        return {
          ok: true,
          statusCode: response.status,
          path: candidatePath,
          body: parseJsonMaybe(raw),
          lastHttpStatus,
          lastBody,
          lastError,
        };
      }
      lastHttpStatus = response.status;
      lastBody = raw;
    } catch (error_) {
      lastError = error_;
    }
  }

  return {
    ok: false,
    statusCode: null,
    path: null,
    body: null,
    lastHttpStatus,
    lastBody,
    lastError,
  };
}

// Try to call a local Piper HTTP service. Tries several common paths.
async function callPiperHttp(text, model) {
  if (!text) throw new Error('missing_text');

  const { baseUrl } = getLocalTtsConfig();
  const candidates = ['/', '/synthesize', '/api/tts', '/tts', '/generate'];
  let lastError = null;

  for (const p of candidates) {
    try {
      const response = await fetch(`${baseUrl}${p}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model }),
        signal: AbortSignal.timeout(10000),
      });
      const raw = await response.text();
      if (!response.ok) {
        lastError = new Error(`piper_http_error ${response.status} ${response.statusText || ''} ${String(raw).slice(0, 200)}`);
        continue;
      }
      return { path: p, body: parseJsonMaybe(raw) };
    } catch (error_) {
      lastError = error_;
    }
  }

  if (lastError?.name === 'TimeoutError') {
    throw new Error('piper_timeout');
  }
  throw new Error('piper_unreachable: ' + String(lastError?.message || lastError || 'unknown_error'));
}

function spawnPiperLocal(text, model) {
  return new Promise((resolve, reject) => {
    try {
      const piper = resolvePiperBinary();
      const modelPath = resolvePiperModel(model);
      ensurePiperModelSidecars(modelPath);

      if (!piper) {
        return reject(new Error('piper binary not found (set PIPER_BIN)'));
      }
      if (!modelPath) {
        return reject(new Error('piper model not found (set TTS_MODEL_PATH or TTS_MODELS_DIR)'));
      }

      const ttsDir = ensurePublicTtsDir();
      try {
        if (!fs.existsSync(ttsDir)) fs.mkdirSync(ttsDir, { recursive: true });
      } catch (error_) {
        console.warn('[TTS][Piper] failed to prepare output directory:', error_.message);
      }

      const ts = Date.now();
      const outFileName = `tts-out-${ts}.wav`;
      const outFile = path.join(ttsDir, outFileName);

      const args = [
        '--model', modelPath,
        '--output_file', outFile
      ];

      let stderr = '';
      let stdout = '';

      const p = spawn(piper.command, args, {
        cwd: piper.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      p.stdout.on('data', (chunk) => {
        stdout += String(chunk || '');
      });

      p.stderr.on('data', (chunk) => {
        stderr += String(chunk || '');
      });

      p.stdin.write(text);
      p.stdin.end();

      let responded = false;

      p.on('close', (code) => {
        if (responded) return;
        responded = true;
        if (code === 0) {
          if (fs.existsSync(outFile)) {
            return resolve({ success: true, audioUrl: `/tts/${outFileName}` });
          }
          return reject(new Error(`tts_failed_no_file${stderr ? ': ' + stderr.trim().slice(0, 500) : ''}`));
        }
        const details = stderr.trim() || stdout.trim();
        return reject(new Error(`tts_failed_exit_${code}${details ? ': ' + details.slice(0, 500) : ''}`));
      });

      p.on('error', (err) => {
        if (responded) return;
        responded = true;
        const details = stderr.trim() || stdout.trim();
        return reject(new Error(`tts_spawn_error: ${String(err?.message)}${details ? ' :: ' + details.slice(0, 500) : ''}`));
      });

    } catch (err) {
      return reject(err);
    }
  });
}


// GET /api/tts/health -> probe local Piper service (try multiple endpoints)
router.get('/tts/health', async (req, res) => {
  const { host, port, baseUrl } = getLocalTtsConfig();
  const preferHttpTts = envBool('ENABLE_PIPER_HTTP', false);
  const rawRequestedVoice = req.query && typeof req.query === 'object'
    ? (req.query.voice ?? req.query.model ?? '')
    : '';
  const requestedVoice = typeof rawRequestedVoice === 'string' ? (rawRequestedVoice.trim() || null) : null;
  const httpProbe = await probePiperHttpHealth(baseUrl, preferHttpTts);
  const { lastHttpStatus, lastBody, lastError } = httpProbe;

  if (httpProbe.ok) {
    return res.json({ ok: true, mode: 'http', statusCode: httpProbe.statusCode, path: httpProbe.path, body: httpProbe.body });
  }

  const spawn = getSpawnReadiness(requestedVoice || 'fr_FR-siwis-medium');
  let httpWarning = null;
  if (preferHttpTts) {
    if (lastError?.name === 'TimeoutError') {
      httpWarning = 'piper_http_timeout';
    } else {
      httpWarning = 'piper_http_unreachable';
    }
  }
  if (spawn.ready) {
    return res.json({
      ok: true,
      mode: 'spawn-ready',
      warning: httpWarning,
      host,
      port,
      requestedModel: spawn.requestedModel,
      piperCommand: spawn.piperCommand,
      modelPath: spawn.modelPath,
      modelJsonPath: spawn.modelJsonPath,
    });
  }

  if (spawn.modelPath && !spawn.modelJsonExists) {
    return res.status(503).json({
      ok: false,
      error: 'model_json_missing',
      requestedModel: spawn.requestedModel,
      modelPath: spawn.modelPath,
      modelJsonCandidates: spawn.modelJsonCandidates,
      modelJsonPath: spawn.modelJsonPath,
    });
  }

  if (!spawn.piperCommand) {
    return res.status(503).json({
      ok: false,
      error: 'piper_binary_missing',
      requestedModel: spawn.requestedModel,
      message: 'No piper executable found (set PIPER_BIN or install piper in PATH).',
    });
  }

  if (!spawn.modelPath) {
    return res.status(503).json({
      ok: false,
      error: 'model_missing',
      requestedModel: spawn.requestedModel,
      message: 'No model file found (set TTS_MODEL_PATH or TTS_MODELS_DIR).',
    });
  }

  if (lastHttpStatus) {
    return res.status(502).json({ ok: false, error: 'piper_unhealthy', statusCode: lastHttpStatus, body: String(lastBody).slice(0, 300), host, port });
  }
  if (lastError?.name === 'TimeoutError') {
    return res.status(504).json({ ok: false, error: 'tts_timeout', host, port });
  }
  return res.status(503).json({ ok: false, error: 'tts_unreachable', message: String(lastError?.message || 'unknown_error'), host, port });
});

// GET /api/tts/models -> list available models under piper/models
router.get('/tts/models', (req, res) => {
  try {
    const configuredDir = String(process.env.TTS_MODELS_DIR || process.env.PIPER_MODELS_DIR || '').trim();
    const modelsDir = configuredDir || path.join(getWorkspaceRoot(), 'apps', 'server', 'tts');
    if (!fs.existsSync(modelsDir)) return res.json({ models: [] });
    const models = listOnnxFiles(modelsDir);
    return res.json({ models, modelsDir });
  } catch (err) {
    console.error('[TTS][Piper] list models error', err);
    return res.status(500).json({ error: 'list_models_failed' });
  }
});

router.post('/tts/piper', async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    const voice = String(req.body?.voice || req.body?.model || '').trim();
    const preferHttpTts = envBool('ENABLE_PIPER_HTTP', false);

    if (!text) {
      return res.status(400).json({ error: 'missing_text' });
    }

    let remoteError = null;

    if (preferHttpTts) {
      try {
        const remote = await requestRemoteTts(req.body);
        return res.json(remote);
      } catch (error_) {
        remoteError = String(error_?.message || error_);
        console.warn('[TTS][Piper] HTTP backend unavailable, trying local spawn:', remoteError);
      }
    }

    try {
      const local = await spawnPiperLocal(text, voice || null);
      return res.json({ ...local, via: 'spawn' });
    } catch (spawnError) {
      return res.status(503).json({
        error: 'tts_unavailable',
        remoteError,
        localError: String(spawnError?.message || spawnError),
      });
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});


module.exports = router;
