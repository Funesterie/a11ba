const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const router = express.Router();

const WORKSPACE_ROOTS = ["D:/A11", "D:/A12"];
const CONV_ROOT = path.join(WORKSPACE_ROOTS[1], "a11_memory", "conversations");
const INDEX_PATH = path.join(CONV_ROOT, "conversations-index.json");

async function ensureDir() {
  await fsp.mkdir(CONV_ROOT, { recursive: true });
}

async function loadIndex() {
  try {
    const raw = await fsp.readFile(INDEX_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function getConversationMessages(id) {
  const convPath = path.join(CONV_ROOT, `conv-${id}.jsonl`);
  try {
    const raw = await fsp.readFile(convPath, "utf8");
    return raw.split("\n").filter(Boolean).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

// GET /api/a11/history
router.get('/api/a11/history', async (req, res) => {
  await ensureDir();
  const index = await loadIndex();
  res.json(index);
});

// GET /api/a11/history/:id
router.get('/api/a11/history/:id', async (req, res) => {
  await ensureDir();
  const id = req.params.id;
  const messages = await getConversationMessages(id);
  res.json({ id, messages });
});

module.exports = router;
