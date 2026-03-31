const express = require('express');

let OpenAI = null;
try {
  OpenAI = require('openai');
} catch (error_) {
  OpenAI = null;
}

const {
  detectImageIntent: defaultDetectImageIntent,
  detectWebImageIntent: defaultDetectWebImageIntent,
  extractWebImageSubject: defaultExtractWebImageSubject,
} = require('../../lib/intent-detection.cjs');
const { duckduckgoImageSearch: defaultDuckduckgoImageSearch } = require('../../lib/image-search.cjs');
const sdToolsModule = require('./sd-tools.cjs');
const {
  generateImageFromText,
  toImageChatProxyPayload,
} = require('../mask/image-chat-runtime.cjs');
const analyzeSemanticIntent = require('../mask/semantic/analyze-semantic-intent.cjs');

function buildClarificationMessage(decision) {
  const optionLines = Array.isArray(decision?.options)
    ? decision.options.map((entry) => String(entry?.promptLine || entry?.label || '').trim()).filter(Boolean)
    : [];
  return [
    String(decision?.question || '').trim(),
    String(decision?.recommendationLine || '').trim(),
    ...optionLines,
    optionLines.length ? "Tu peux repondre juste par 1, 2, dire \"vas-y\", ou reformuler clairement." : '',
  ].filter(Boolean).join('\n');
}

function createOpenAIClient() {
  if (!OpenAI) return null;
  return new OpenAI({
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || 'dummy',
    defaultHeaders: {
      'X-NEZ-TOKEN': process.env.NEZ_ALLOWED_TOKEN || process.env.NEZ_TOKENS || 'nez:a11-client-funesterie-pro',
    },
  });
}

function resolveChatDependencies(overrides = {}) {
  return {
    openaiClient: overrides.openaiClient || createOpenAIClient(),
    detectImageIntent: overrides.detectImageIntent || defaultDetectImageIntent,
    detectWebImageIntent: overrides.detectWebImageIntent || defaultDetectWebImageIntent,
    extractWebImageSubject: overrides.extractWebImageSubject || defaultExtractWebImageSubject,
    duckduckgoImageSearch: overrides.duckduckgoImageSearch || defaultDuckduckgoImageSearch,
    generateSd: overrides.generateSd || sdToolsModule.generateSdInternal,
  };
}

function createChatRouter(overrides = {}) {
  const {
    openaiClient,
    detectImageIntent,
    detectWebImageIntent,
    extractWebImageSubject,
    duckduckgoImageSearch,
    generateSd,
  } = resolveChatDependencies(overrides);

  const router = express.Router();

  router.post('/chat', express.json({ limit: '2mb' }), async (req, res) => {
    try {
      const userMessage = String(req.body?.message || req.body?.prompt || '').trim();
      if (!userMessage) {
        return res.status(400).json({ ok: false, error: 'missing_message' });
      }

      if (typeof detectWebImageIntent === 'function' && detectWebImageIntent(userMessage)) {
        const subject = typeof extractWebImageSubject === 'function'
          ? extractWebImageSubject(userMessage)
          : null;
        console.log(`[A11][chat] Intention: image web | sujet: ${subject || 'unknown'}`);
        if (!subject) {
          return res.status(400).json({ ok: false, error: 'missing_subject' });
        }

        try {
          const result = await duckduckgoImageSearch(subject);
          return res.json({
            ok: true,
            artifact_type: 'web_image',
            image_url: result.image_url,
            source_url: result.source_url,
            title: result.title || subject,
            width: result.width,
            height: result.height,
          });
        } catch (error_) {
          return res.status(502).json({
            ok: false,
            error: 'web_image_search_failed',
            message: String(error_?.message || error_),
          });
        }
      }

      if (typeof detectImageIntent === 'function' && detectImageIntent(userMessage)) {
        console.log(`[A11][chat] Intention: génération image | prompt: ${userMessage}`);
        const semanticAnalysis = analyzeSemanticIntent(userMessage, {
          detectImageIntent,
          detectWebImageIntent,
        });
        if (semanticAnalysis?.decision?.shouldClarify) {
          return res.json({
            ok: true,
            mode: 'need_clarification',
            assistant: buildClarificationMessage(semanticAnalysis.decision),
            clarification: {
              question: semanticAnalysis.decision.question,
              options: semanticAnalysis.decision.options,
              recommendedIntentType: semanticAnalysis.decision.recommendedIntentType,
              recommendationLine: semanticAnalysis.decision.recommendationLine,
            },
            semantic: {
              topIntents: semanticAnalysis.topIntents.slice(0, 3),
              confidence: semanticAnalysis.summary?.confidence || 0,
            },
          });
        }
        try {
          const imageResult = await generateImageFromText({
            req,
            text: userMessage,
            generateSd,
          });
          return res.json(toImageChatProxyPayload(imageResult));
        } catch (error_) {
          return res.status(error_?.statusCode || 500).json(
            error_?.payload || {
              ok: false,
              error: 'sd_call_failed',
              message: String(error_?.message || error_),
            }
          );
        }
      }

      console.log(`[A11][chat] Intention: fallback LLM | message: ${userMessage}`);
      if (!openaiClient) {
        return res.status(500).json({ ok: false, error: 'llm_unavailable' });
      }

      const completion = await openaiClient.chat.completions.create({
        model: process.env.A11_OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Tu es l’assistant A11. Si la demande est une génération d’image réelle, ne réponds pas en texte, laisse le routeur déclencher le tool.',
          },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 512,
      });

      const text = completion?.choices?.[0]?.message?.content || '';
      return res.json({ ok: true, mode: 'llm', assistant: text });
    } catch (error_) {
      return res.status(500).json({
        ok: false,
        error: 'internal_error',
        message: String(error_?.message || error_),
      });
    }
  });

  return router;
}

function looksLikeDependencyBag(value) {
  return !!(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      'openaiClient' in value
      || 'detectImageIntent' in value
      || 'detectWebImageIntent' in value
      || 'extractWebImageSubject' in value
      || 'duckduckgoImageSearch' in value
      || 'generateSd' in value
    )
  );
}

const defaultRouter = createChatRouter();

function chatEntrypoint(...args) {
  if (args.length === 1 && looksLikeDependencyBag(args[0])) {
    return createChatRouter(args[0]);
  }
  return defaultRouter(...args);
}

chatEntrypoint.router = defaultRouter;
chatEntrypoint.createChatRouter = createChatRouter;

module.exports = chatEntrypoint;
