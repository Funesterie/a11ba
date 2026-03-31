const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');

const analyzeSemanticIntent = require('../src/mask/semantic/analyze-semantic-intent.cjs');
const textToWazaa = require('../src/mask/text-to-wazaa.cjs');
const wazaaToMask = require('../src/mask/wazaa-to-mask.cjs');
const createChatRouter = require('../src/routes/chat.cjs');

async function withServer(registerRoutes, runAssertions) {
  const app = express();
  registerRoutes(app);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await runAssertions(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error_) => (error_ ? reject(error_) : resolve()));
    });
  }
}

async function postJson(baseUrl, path, body, headers = {}) {
  const response = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  return { response, json };
}

test('analyzeSemanticIntent requests clarification for ambiguous show-subject prompts', () => {
  const result = analyzeSemanticIntent('montre moi goku', {});

  assert.equal(result?.decision?.shouldClarify, true);
  assert.equal(result?.subject, 'goku');
  assert.deepEqual(
    result.decision.candidates.map((entry) => entry.type).sort(),
    ['image.generate', 'web.image.search']
  );
  assert.match(String(result.decision.question || ''), /genere une image|cherche une image/i);
  assert.match(String(result.decision.recommendationLine || ''), /vas-y/i);
  assert.ok(String(result.decision.recommendedIntentType || '').length > 0);
});

test('analyzeSemanticIntent keeps explicit image prompts on image.generate', () => {
  const result = analyzeSemanticIntent('genere une image de goku super saiyan', {});

  assert.equal(result?.decision?.shouldClarify, false);
  assert.equal(result?.decision?.selectedIntentType, 'image.generate');
  assert.equal(result?.topIntents?.[0]?.type, 'image.generate');
  assert.ok(Number(result?.summary?.confidence || 0) >= 0.5);
});

test('textToWazaa and wazaaToMask preserve semantic hierarchy and only emit image masks for image intents', () => {
  const imageWazaa = textToWazaa('genere une image de goku dans le ciel', {});
  assert.equal(imageWazaa?.intent?.type, 'image.generate');
  assert.equal(imageWazaa?.meta?.sourceText, 'genere une image de goku dans le ciel');
  assert.ok(imageWazaa?.hierarchy?.message);

  const imageMask = wazaaToMask(imageWazaa);
  assert.equal(imageMask?.intent, 'image.generate');
  assert.equal(imageMask?.raw, 'genere une image de goku dans le ciel');
  assert.ok(Array.isArray(imageMask?.inputs?.subject));
  assert.ok(imageMask.inputs.subject.includes('goku'));

  const codeWazaa = textToWazaa('ecris un script python pour trier des png', {});
  assert.equal(codeWazaa?.intent?.type, 'code.python.generate');
  assert.equal(wazaaToMask(codeWazaa), null);
});

test('POST /api/chat returns need_clarification when semantic intent stays ambiguous', async () => {
  await withServer(
    (app) => {
      app.use('/api', createChatRouter({
        openaiClient: null,
        detectImageIntent: () => true,
        detectWebImageIntent: () => false,
        extractWebImageSubject: () => null,
        duckduckgoImageSearch: async () => {
          throw new Error('should_not_be_called');
        },
        generateSd: async () => {
          throw new Error('should_not_be_called');
        },
      }));
    },
    async (baseUrl) => {
      const { response, json } = await postJson(baseUrl, '/api/chat', {
        message: 'montre moi goku',
      });

      assert.equal(response.status, 200);
      assert.equal(json.ok, true);
      assert.equal(json.mode, 'need_clarification');
      assert.match(String(json.assistant || ''), /1\./);
      assert.match(String(json.assistant || ''), /2\./);
      assert.match(String(json.assistant || ''), /vas-y/i);
      assert.equal(Array.isArray(json.clarification?.options), true);
      assert.equal(json.clarification.options.length, 2);
      assert.ok(String(json.clarification?.recommendedIntentType || '').length > 0);
    }
  );
});
