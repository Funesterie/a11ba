/**
 * Process Supervision Integration for A11
 * Currently manages: Cerbère (LLM Router), TTS Service
 * TODO: Add llama-server when needed
 */

const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const { A11Supervisor } = require('./a11-supervisor.cjs');

// Always available since we have our own implementation
const qflushAvailable = true;

// Helper: check if a TCP port is already in use
function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', (err) => {
      try { srv.close(); } catch {}
      resolve(err.code === 'EADDRINUSE');
    });
    srv.once('listening', () => {
      try { srv.close(); } catch {}
      resolve(false);
    });
    srv.listen(port, host);
  });
}

/**
 * Register a process for supervision
 * @param {A11Supervisor} supervisor - Supervisor instance
 * @param {Object} processConfig - Process configuration
 * @returns {boolean} Success status
 */
function registerProcess(supervisor, processConfig) {
  if (!supervisor) {
    console.warn('[Supervisor] Cannot register process: supervisor not initialized');
    return false;
  }

  try {
    supervisor.register(processConfig);
    return true;
  } catch (e) {
    console.error('[Supervisor] Process registration failed:', e.message);
    return false;
  }
}

/**
 * Start supervised process
 * @param {A11Supervisor} supervisor - Supervisor instance
 * @param {string} processName - Name of the process to start
 * @returns {boolean} Success status
 */
async function startProcess(supervisor, processName) {
  if (!supervisor) {
    console.warn('[Supervisor] Cannot start process: supervisor not initialized');
    return false;
  }

  try {
    // Prevent duplicate Cerbère instances on port 4545
    if (processName === 'cerbere') {
      const inUse = await isPortInUse(4545);
      if (inUse) {
        console.warn('[Supervisor] Cerbère port 4545 already in use — skipping start');
        return false;
      }
    }

    supervisor.start(processName);
    return true;
  } catch (e) {
    console.error('[Supervisor] Failed to start process:', e.message);
    return false;
  }
}

/**
 * Stop supervised process
 * @param {A11Supervisor} supervisor - Supervisor instance
 * @param {string} processName - Name of the process to stop
 * @returns {boolean} Success status
 */
function stopProcess(supervisor, processName) {
  if (!supervisor) {
    console.warn('[Supervisor] Cannot stop process: supervisor not initialized');
    return false;
  }

  try {
    supervisor.stop(processName);
    return true;
  } catch (e) {
    console.error('[Supervisor] Failed to stop process:', e.message);
    return false;
  }
}

/**
 * Restart supervised process
 * @param {A11Supervisor} supervisor - Supervisor instance
 * @param {string} processName - Name of the process to restart
 * @returns {boolean} Success status
 */
function restartProcess(supervisor, processName) {
  if (!supervisor) {
    console.warn('[Supervisor] Cannot restart process: supervisor not initialized');
    return false;
  }

  try {
    supervisor.restart(processName);
    return true;
  } catch (e) {
    console.error('[Supervisor] Failed to restart process:', e.message);
    return false;
  }
}

/**
 * Get status of supervised processes
 * @param {A11Supervisor} supervisor - Supervisor instance
 * @returns {Object} Status information
 */
function getStatus(supervisor) {
  if (!supervisor) {
    return { available: false, error: 'Supervisor not initialized', processes: {} };
  }

  try {
    if (typeof supervisor.getStatus === 'function') {
      const status = supervisor.getStatus();
      return { available: true, ...status };
    }
    // Fallback: build minimal status from known fields
    const processes = {};
    try {
      if (supervisor.processes && typeof supervisor.processes.forEach === 'function') {
        supervisor.processes.forEach((entry, name) => {
          const uptime = entry.startTime && entry.status === 'running'
            ? ((Date.now() - entry.startTime) / 1000).toFixed(2)
            : null;
          processes[name] = {
            status: entry.status || 'unknown',
            pid: entry.pid || null,
            restarts: entry.restarts || 0,
            uptime,
            autoRestart: entry.config ? entry.config.autoRestart : undefined
          };
        });
      }
    } catch {}
    return {
      available: true,
      supervisor: { config: supervisor.config || {} },
      processes
    };
  } catch (e) {
    console.error('[Supervisor] Failed to get status:', e.message);
    return { available: true, error: e.message, processes: {} };
  }
}

/**
 * Setup supervisor for A11 services
 * Currently manages: Cerbère (LLM Router) and TTS Service
 * @returns {A11Supervisor} Configured supervisor instance
 */
async function setupA11Supervisor() {
  const supervisor = await initQflush({
    maxRestarts: 3,
    restartDelay: 3000,
    logDir: path.resolve(__dirname, '../../logs/supervisor')
  });

  if (!supervisor) {
    return null;
  }

  const BASE = path.resolve(__dirname, '..');
  
  // Service management flags from env
  const manageCerbere = process.env.MANAGE_CERBERE !== 'false';
  const manageTTS = process.env.MANAGE_TTS === 'true';
  
  // 1. Cerbère (LLM Router on port 4545)
  if (manageCerbere) {
    const cerbereScript = path.join(BASE, 'llm-router.mjs');
    
    if (fs.existsSync(cerbereScript)) {
      // Skip registering Cerbère if port is already in use
      const inUse = await isPortInUse(4545);
      if (inUse) {
        console.warn('[Supervisor] Detected Cerbère already running on 4545 — skipping supervision registration');
      } else {
        console.log('[Supervisor] ✓ Registering Cerbère (LLM Router) for supervision');
        console.log('[Supervisor]   Script:', cerbereScript);
        console.log('[Supervisor]   Port: 4545');
        
        registerProcess(supervisor, {
          name: 'cerbere',
          command: 'node',
          args: [cerbereScript],
          cwd: path.dirname(cerbereScript),
          env: { 
            PORT: '4545',
            LLM_ROUTER_PORT: '4545'
          },
          autoRestart: true
        });
      }
    } else {
      console.error('[Supervisor] ✗ Cerbère script NOT FOUND at:', cerbereScript);
    }
  } else {
    console.log('[Supervisor] Cerbère management disabled (MANAGE_CERBERE=false)');
  }

  // 2. TTS Service (Piper)
  if (manageTTS) {
    const ttsScript = findTTSScript();
    const ttsPort = process.env.TTS_PORT || '5002';
    
    if (ttsScript) {
      console.log('[Supervisor] ✓ Registering TTS Service for supervision');
      console.log('[Supervisor]   Script:', ttsScript);
      console.log('[Supervisor]   Port:', ttsPort);
      
      // Detect if Python or Node.js script
      const isPython = ttsScript.endsWith('.py');
      
      registerProcess(supervisor, {
        name: 'tts',
        command: isPython ? 'python' : 'node',
        args: [ttsScript],
        cwd: path.dirname(ttsScript),
        env: {
          TTS_PORT: ttsPort,
          PIPER_DIR: path.resolve(__dirname, '../../piper')
        },
        autoRestart: true
      });
    } else {
      console.warn('[Supervisor] ✗ TTS script NOT FOUND (searched: serve.py, server.py, piper/serve.py)');
      console.warn('[Supervisor]   Set MANAGE_TTS=false to disable or add TTS script to expected locations');
    }
  } else {
    console.log('[Supervisor] TTS management disabled (MANAGE_TTS not set to true)');
  }

  return supervisor;
}

// Helper functions

function findTTSScript() {
  const BASE = path.resolve(__dirname, '../..');
  const candidates = [
    path.join(BASE, 'tts', 'serve.py'),
    path.join(BASE, 'tts', 'server.py'),
    path.join(BASE, 'piper', 'serve.py'),
    path.join(BASE, 'piper', 'server.py')
  ];
  
  for (const script of candidates) {
    if (fs.existsSync(script)) {
      console.log('[Supervisor] Found TTS script at:', script);
      return script;
    }
  }
  
  return null;
}

/**
 * Initialize supervisor
 * @param {Object} options - Configuration options
 * @returns {A11Supervisor} Supervisor instance
 */
async function initQflush(options = {}) {
  try {
    const config = {
      maxRestarts: options.maxRestarts || 3,
      restartDelay: options.restartDelay || 3000,
      logDir: options.logDir || path.resolve(__dirname, '../../logs/supervisor'),
      ...options
    };

    console.log('[Supervisor] Initializing A11 supervisor...');
    const supervisor = new A11Supervisor(config);
    return supervisor;
  } catch (e) {
    console.error('[Supervisor] Initialization failed:', e.message);
    return null;
  }
}

/**
 * Run a QFLUSH flow (pipeline) with given arguments
 * @param {string} flow - Flow name
 * @param {object} payload - Arguments for the flow
 * @returns {Promise<object>} Result of the flow
 */
async function runQflushFlow(flow, payload) {
  // Try Node module first
  try {
    const qflush = require('@funeste38/qflush');
    if (typeof qflush.run === 'function') {
      return await qflush.run({ flow, payload });
    }
    throw new Error('qflush Node module does not export run()');
  } catch (e) {
    // Fallback to EXE
    const exe = globalThis.__QFLUSH_PATH || process.env.QFLUSH_EXE_PATH;
    if (!exe) throw new Error('No qflush.exe found');
    const { spawn } = require('child_process');
    const args = ['run', flow, '--input', JSON.stringify(payload)];
    return new Promise((resolve, reject) => {
      const p = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      p.stdout.on('data', d => (out += d.toString()));
      p.stderr.on('data', d => (err += d.toString()));
      p.on('close', code => {
        if (code !== 0) {
          return reject(new Error(`qflush exit ${code}: ${err}`));
        }
        try {
          resolve(JSON.parse(out));
        } catch {
          resolve({ ok: true, raw: out });
        }
      });
    });
  }
}

module.exports = {
  qflushAvailable,
  initQflush, // version asynchrone unique
  registerProcess,
  startProcess,
  stopProcess,
  restartProcess,
  getStatus,
  setupA11Supervisor,
  // Export helper for external use
  findTTSScript,
  runQflushFlow
};
