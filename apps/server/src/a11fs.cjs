const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');

const a11fs = {
  // Analyse & édition
  async getCompilationErrors() { return []; },
  async getProjectStructure() { return {}; },
  async getSolutionInfo() { return {}; },
  async getActiveDocument() { return {}; },
  async getCurrentSelection() { return ''; },
  async insertAtCursor(text) { return true; },
  async replaceSelection(newText) { return true; },

  // Fichiers
  async deleteFile(filePath) { await fs.unlink(filePath); return true; },
  async renameFile(oldPath, newPath) { await fs.rename(oldPath, newPath); return true; },

  // VS Integration
  async openFile(filePath) { return true; },
  async gotoLine(filePath, line) { return true; },
  async buildSolution() { return true; },
  async getWorkspaceRoot() { return process.cwd(); },

  // Nouveaux modules
  async readFile(filePath) {
    return await fs.readFile(filePath, 'utf8');
  },
  async applyPatch(filePath, search, replace) {
    let content = await fs.readFile(filePath, 'utf8');
    content = content.replace(search, replace);
    await fs.writeFile(filePath, content, 'utf8');
    return true;
  },
  async listDir(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(e => ({ name: e.name, isDir: e.isDirectory() }));
  },
  async batch(operations) {
    // Exécute chaque opération (write_file, mkdir, etc.)
    return Promise.all(operations.map(async op => {
      switch (op.action) {
        case 'write_file':
          await fs.writeFile(op.path, op.content, 'utf8');
          return { action: 'write_file', path: op.path };
        case 'mkdir':
          await fs.mkdir(op.path, { recursive: true });
          return { action: 'mkdir', path: op.path };
        default:
          return { error: 'Unknown batch action', action: op.action };
      }
    }));
  },
  async exec(command) {
    return new Promise((resolve, reject) => {
      exec(command, { cwd: process.cwd() }, (err, stdout, stderr) => {
        if (err) return reject(stderr || err.message);
        resolve(stdout);
      });
    });
  },
  async indexProject() {
    // Indexe tous les fichiers du projet (stub)
    return [];
  },
  async gitOps(op, message) {
    // Exécute les commandes git correspondantes (stub)
    return true;
  },
  async createTaskList(description) {
    // Crée une liste de tâches (stub)
    return [];
  },
  async setGitHubIssue(issueId, title, body, assignee, labels, milestone) {
    // Crée ou met à jour un ticket GitHub (stub)
    return true;
  }
};

module.exports = a11fs;
