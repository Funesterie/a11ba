/**
 * A11 Filesystem API Routes
 * Endpoints pour intégration VSIX ↔ A11FS
 * Phase 1: OpenFile, InsertCode, RunCommand, ReadFile, WriteFile
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

/**
 * Register A11FS API routes
 * @param {express.Router} router - Express router instance
 */
function registerA11FsRoutes(router) {
  console.log('[A11FS] Registering filesystem API routes...');

  // Health check
  router.get('/fs/health', (req, res) => {
    res.json({
      ok: true,
      available: true,
      mode: 'server-side',
      capabilities: ['read', 'write', 'list', 'execute', 'vs-integration']
    });
  });

  // Get workspace root
  router.get('/fs/workspace', async (req, res) => {
    try {
      const root = process.env.WORKSPACE_ROOT || process.cwd();
      res.json({ root, exists: fsSync.existsSync(root) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Read file
  router.post('/fs/read', async (req, res) => {
    try {
      const { path: filePath } = req.body;
      if (!filePath) return res.status(400).json({ error: 'path required' });

      const fullPath = path.resolve(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      res.json({ path: fullPath, content, exists: true });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.json({ path: req.body.path, content: null, exists: false });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Write file
  router.post('/fs/write', async (req, res) => {
    try {
      const { path: filePath, content } = req.body;
      if (!filePath) return res.status(400).json({ error: 'path required' });
      if (content === undefined) return res.status(400).json({ error: 'content required' });

      const fullPath = path.resolve(filePath);
      const dir = path.dirname(fullPath);

      // Create directory if needed
      if (!fsSync.existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }

      await fs.writeFile(fullPath, content, 'utf-8');
      res.json({ success: true, path: fullPath });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Check file exists
  router.post('/fs/exists', async (req, res) => {
    try {
      const { path: filePath } = req.body;
      if (!filePath) return res.status(400).json({ error: 'path required' });

      const fullPath = path.resolve(filePath);
      const exists = fsSync.existsSync(fullPath);
      res.json({ path: fullPath, exists });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // List files in directory
  router.post('/fs/list', async (req, res) => {
    try {
      const { directory } = req.body;
      if (!directory) return res.status(400).json({ error: 'directory required' });

      const fullPath = path.resolve(directory);
      if (!fsSync.existsSync(fullPath)) {
        return res.json({ directory: fullPath, files: [], exists: false });
      }

      const files = await fs.readdir(fullPath);
      const fullPaths = files.map(f => path.join(fullPath, f));
      res.json({ directory: fullPath, files: fullPaths, exists: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Execute shell command (with safety checks)
  router.post('/fs/shell', async (req, res) => {
    try {
      const { command } = req.body;
      if (!command) return res.status(400).json({ error: 'command required' });

      // Basic security: whitelist certain commands or check for dangerous patterns
      const dangerous = /rm\s+-rf|del\s+\/f|format|shutdown|reboot/i;
      if (dangerous.test(command)) {
        return res.status(403).json({ error: 'dangerous command blocked' });
      }

      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);

      const { stdout, stderr } = await execPromise(command, {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024
      });

      res.json({
        success: true,
        stdout,
        stderr,
        command
      });
    } catch (err) {
      res.status(500).json({
        error: err.message,
        stdout: err.stdout || '',
        stderr: err.stderr || ''
      });
    }
  });

  // VS Integration: Open file (proxy to VSIX via websocket or polling)
  router.post('/fs/vs/open', async (req, res) => {
    try {
      const { path: filePath } = req.body;
      if (!filePath) return res.status(400).json({ error: 'path required' });

      // This endpoint is a placeholder for server-side tracking
      // Actual OpenFile is handled by VSIX via a11host.ts
      res.json({
        success: true,
        message: 'OpenFile command queued (handled by VSIX)',
        path: filePath
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // VS Integration: Go to line
  router.post('/fs/vs/goto', async (req, res) => {
    try {
      const { path: filePath, line } = req.body;
      if (!filePath) return res.status(400).json({ error: 'path required' });
      if (!line) return res.status(400).json({ error: 'line required' });

      res.json({
        success: true,
        message: 'GotoLine command queued (handled by VSIX)',
        path: filePath,
        line
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // VS Integration: Insert code at cursor
  router.post('/fs/vs/insert', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: 'text required' });

      res.json({
        success: true,
        message: 'InsertAtCursor command queued (handled by VSIX)',
        text
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // VS Integration: Execute VS command
  router.post('/fs/vs/command', async (req, res) => {
    try {
      const { command, args } = req.body;
      if (!command) return res.status(400).json({ error: 'command required' });

      res.json({
        success: true,
        message: 'VS command queued (handled by VSIX)',
        command,
        args: args || ''
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // VS Integration: Build solution
  router.post('/fs/vs/build', async (req, res) => {
    try {
      res.json({
        success: true,
        message: 'Build command queued (handled by VSIX)'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log('[A11FS] ✓ Filesystem API routes registered');
}

module.exports = { registerA11FsRoutes };
