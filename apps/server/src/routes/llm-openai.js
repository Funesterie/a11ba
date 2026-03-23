const { askOpenAI, streamOpenAI } = require("../../providers/openai");
const { buildLongTermMemorySnippet } = require("../../lib/a11-longterm.cjs");

function registerOpenAIRoutes(router) {
  // POST /llm/openai
  router.post('/llm/openai', async (req, res) => {
    try {
      const { prompt, history, model, systemPrompt } = req.body || {};

      if (!prompt && !(Array.isArray(history) && history.length)) {
        return res.status(400).json({ ok: false, error: 'Missing prompt or history' });
      }

      const messages = (Array.isArray(history) && history.length)
        ? history
        : [
            systemPrompt ? { role: 'system', content: systemPrompt } : null,
            { role: 'user', content: prompt }
          ].filter(Boolean);

      // Inject long-term memory snippet as a system message
      const ltmSnippet = await buildLongTermMemorySnippet();
      const finalMessages = [
        ...messages,
        { role: 'system', content: ltmSnippet }
      ];

      const output = await askOpenAI({ model, systemPrompt, messages: finalMessages });

      res.json({ ok: true, output });
    } catch (err) {
      console.error('[A11/OpenAI] error:', err);
      res.status(500).json({ ok: false, error: (err && err.message) || 'OpenAI error' });
    }
  });

  // POST /llm/openai/stream  (SSE)
  router.post('/llm/openai/stream', async (req, res) => {
    try {
      const { prompt, history, model, systemPrompt } = req.body || {};

      if (!prompt && !(Array.isArray(history) && history.length)) {
        res.status(400).end();
        return;
      }

      const messages = (Array.isArray(history) && history.length)
        ? history
        : [
            systemPrompt ? { role: 'system', content: systemPrompt } : null,
            { role: 'user', content: prompt }
          ].filter(Boolean);

      // Inject long-term memory snippet as a system message
      const ltmSnippet = await buildLongTermMemorySnippet();
      const finalMessages = [
        ...messages,
        { role: 'system', content: ltmSnippet }
      ];

      // Headers SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (res.flushHeaders) res.flushHeaders();

      let buffer = '';

      await streamOpenAI({ model, systemPrompt, messages: finalMessages }, (delta) => {
        buffer += delta;
        const payload = JSON.stringify({ delta, full: buffer });
        try {
          res.write(`data: ${payload}\n\n`);
        } catch (e) {
          // ignore write errors
        }
      });

      // End of stream
      try {
        res.write(`data: ${JSON.stringify({ done: true, full: buffer })}\n\n`);
      } catch (e) {}
      res.end();
    } catch (err) {
      console.error('[A11/OpenAI stream] error:', err);
      try {
        res.write(`data: ${JSON.stringify({ error: (err && err.message) || 'OpenAI stream error' })}\n\n`);
      } catch {}
      res.end();
    }
  });

  // La route /v1/chat/completions est supprimée pour éviter les doublons
}

module.exports = { registerOpenAIRoutes };
