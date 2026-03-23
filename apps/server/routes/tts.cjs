const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

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
        results.push(rel.replace(/\\/g, '/'));
      }
    }
  }
  try {
    walk(modelsDir);
  } catch (e) {
    return [];
  }
  return results;
}

// Try to call a local Piper HTTP service. Tries several common paths.
function callPiperHttp(text, model) {
  return new Promise((resolve, reject) => {
    if (!text) return reject(new Error('missing_text'));
    const host = '127.0.0.1';
    const port = Number(process.env.TTS_PORT || 5002);
    const candidates = ['/', '/synthesize', '/api/tts', '/tts', '/generate'];
    let tried = 0;

    function tryPath(p) {
      tried++;
      const payload = JSON.stringify({ text, model });
      const opts = {
        hostname: host,
        port,
        path: p,
        method: 'POST',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = http.request(opts, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk.toString()));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // try parse JSON, otherwise return raw
            try {
              const json = JSON.parse(body);
              return resolve({ path: p, body: json });
            } catch (e) {
              return resolve({ path: p, body: body });
            }
          }
          // non-2xx -> try next candidate or fail
          if (tried < candidates.length) return tryPath(candidates[tried]);
          return reject(new Error(`piper_http_error ${res.statusCode} ${res.statusMessage || ''} ${body.slice ? body.slice(0,200) : ''}`));
        });
      });

      req.on('error', (err) => {
        // try next candidate if any
        if (tried < candidates.length) return tryPath(candidates[tried]);
        return reject(new Error('piper_unreachable: ' + err.message));
      });

      req.on('timeout', () => {
        req.destroy();
        if (tried < candidates.length) return tryPath(candidates[tried]);
        return reject(new Error('piper_timeout'));
      });

      req.write(payload);
      req.end();
    }

    tryPath(candidates[0]);
  });
}

function spawnPiperLocal(text, model) {
  return new Promise((resolve, reject) => {
    try {
      const baseDir = path.resolve(__dirname, '..', '..', '..');
      const piperExe = path.join(baseDir, 'piper', 'piper.exe');
      const modelsDir = path.join(baseDir, 'piper', 'models');

      // Default to siwis model
      const modelPath = model ? path.join(modelsDir, model) : path.join(modelsDir, 'fr_FR-siwis-medium.onnx');

      if (!fs.existsSync(piperExe)) {
        return reject(new Error('piper not installed'));
      }
      if (!fs.existsSync(modelPath)) {
        return reject(new Error('piper model not found: ' + modelPath));
      }

      const publicDir = path.join(baseDir, 'public');
      const ttsDir = path.join(publicDir, 'tts');
      try {
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
        if (!fs.existsSync(ttsDir)) fs.mkdirSync(ttsDir, { recursive: true });
      } catch (e) { /* ignore */ }

      const ts = Date.now();
      const outFileName = `tts-out-${ts}.wav`;
      const outFile = path.join(ttsDir, outFileName);

      const args = [
        '--model', modelPath,
        '--output_file', outFile
      ];

      const p = spawn(piperExe, args, {
        cwd: path.dirname(piperExe),
        stdio: ['pipe', 'ignore', 'inherit'],
        windowsHide: true
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
          return reject(new Error('tts_failed_no_file'));
        }
        return reject(new Error('tts_failed_exit_' + code));
      });

      p.on('error', (err) => {
        if (responded) return;
        responded = true;
        return reject(new Error('tts_spawn_error: ' + String(err && err.message)));
      });

    } catch (err) {
      return reject(err);
    }
  });
}


// GET /api/tts/health -> probe local Piper service (try multiple endpoints)
router.get('/tts/health', (req, res) => {
  const host = '127.0.0.1';
  const port = Number(process.env.TTS_PORT || 5002);
  const candidates = ['/health', '/api/tts', '/', '/synthesize', '/tts'];
  let tried = 0;

  function tryPath(idx) {
    const p = candidates[idx];
    const options = {
      hostname: host,
      port,
      path: p,
      method: 'GET',
      timeout: 3000
    };

    const reqProbe = http.request(options, (r) => {
      const { statusCode } = r;
      let body = '';
      r.on('data', (chunk) => (body += chunk.toString()));
      r.on('end', () => {
        if (statusCode >= 200 && statusCode < 300) {
          // successful probe
          try {
            const json = JSON.parse(body || '{}');
            return res.json({ ok: true, statusCode, path: p, body: json });
          } catch (e) {
            return res.json({ ok: true, statusCode, path: p, body });
          }
        }
        // not OK -> try next
        tried++;
        if (tried < candidates.length) return tryPath(tried);
        return res.status(502).json({ ok: false, error: 'piper_unhealthy', statusCode, body });
      });
    });

    reqProbe.on('error', (err) => {
      tried++;
      if (tried < candidates.length) return tryPath(tried);
      return res.status(503).json({ ok: false, error: 'tts_unreachable', message: String(err && err.message) });
    });

    reqProbe.on('timeout', () => {
      reqProbe.destroy();
      tried++;
      if (tried < candidates.length) return tryPath(tried);
      return res.status(504).json({ ok: false, error: 'tts_timeout' });
    });

    reqProbe.end();
  }

  tryPath(0);
});

// GET /api/tts/models -> list available models under piper/models
router.get('/tts/models', (req, res) => {
  try {
    // baseDir should point to repository root (move up three levels)
    const baseDir = path.resolve(__dirname, '..', '..', '..');
    const modelsDir = path.join(baseDir, 'piper', 'models');
    if (!fs.existsSync(modelsDir)) return res.json({ models: [] });
    const models = listOnnxFiles(modelsDir);
    return res.json({ models });
  } catch (err) {
    console.error('[TTS][Piper] list models error', err);
    return res.status(500).json({ error: 'list_models_failed' });
  }
});

router.post('/tts/piper', async (req, res) => {
  try {
    const response = await fetch('http://127.0.0.1:5002/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      // fallback: try to get text (path)
      const txt = await response.text();
      // if it's a path to wav, wrap it
      if (typeof txt === 'string' && txt.endsWith('.wav')) {
        return res.json({ audio_url: txt.startsWith('/tts/') ? txt : '/tts/' + path.basename(txt) });
      }
      return res.status(500).json({ error: 'Invalid Piper response', detail: txt });
    }
    // always return audio_url
    const audioUrl = data.audio_url || data.audioUrl || data.url || data.path || data.file || data.wav || null;
    if (audioUrl) {
      return res.json({ audio_url: audioUrl.startsWith('/tts/') ? audioUrl : '/tts/' + path.basename(audioUrl) });
    }
    // fallback: if body is a string path
    if (typeof data === 'string' && data.endsWith('.wav')) {
      return res.json({ audio_url: data.startsWith('/tts/') ? data : '/tts/' + path.basename(data) });
    }
    return res.status(500).json({ error: 'No audio_url in Piper response', detail: data });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});


module.exports = router;
