const buildMaskImageGenerateFromText = require('./text-to-mask-image-generate.cjs');
const normalizeMaskImageGenerate = require('./normalize-mask-image-generate.cjs');
const validateMaskImageGenerate = require('./validate-mask-image-generate.cjs');
const compileMaskToSD = require('./compile-mask-to-sd.cjs');
const adaptMaskToFreelandValue = require('./adapt-mask-to-freeland-value.cjs');

function extractLatestUserMessage(body = {}) {
  if (typeof body?.message === 'string' && body.message.trim()) return body.message.trim();
  if (typeof body?.prompt === 'string' && body.prompt.trim()) return body.prompt.trim();

  if (Array.isArray(body?.messages)) {
    for (let index = body.messages.length - 1; index >= 0; index -= 1) {
      const entry = body.messages[index];
      if (String(entry?.role || '').trim().toLowerCase() !== 'user') continue;

      if (typeof entry?.content === 'string' && entry.content.trim()) {
        return entry.content.trim();
      }

      if (Array.isArray(entry?.content)) {
        const text = entry.content
          .map((part) => {
            if (typeof part === 'string') return part;
            if (part && typeof part === 'object' && typeof part.text === 'string') return part.text;
            return '';
          })
          .join(' ')
          .trim();
        if (text) return text;
      }
    }
  }

  return '';
}

function buildSdRequestBody(mask, compiledPayload) {
  const payload = compiledPayload && typeof compiledPayload === 'object'
    ? compiledPayload
    : {};

  return {
    prompt: String(payload.prompt || mask?.raw || '').trim(),
    negative_prompt: String(payload.negative_prompt || '').trim(),
    width: Number(payload.width || mask?.options?.width || 768),
    height: Number(payload.height || mask?.options?.height || 768),
    num_inference_steps: Number(payload.steps || mask?.options?.steps || 30),
    guidance_scale: Number(payload.guidance_scale || mask?.options?.guidance_scale || 7.5),
    ...(payload.seed !== undefined ? { seed: payload.seed } : {}),
    ...(payload.sampler ? { sampler: payload.sampler } : {}),
  };
}

function compileMaskImageGenerate(rawMask) {
  const mask = normalizeMaskImageGenerate(rawMask);
  const validation = validateMaskImageGenerate(mask);
  if (!validation.valid) {
    const error = new Error('invalid_mask');
    error.statusCode = 400;
    error.payload = {
      ok: false,
      error: 'invalid_mask',
      details: validation.errors,
      mask,
    };
    throw error;
  }

  const compiledPayload = compileMaskToSD(mask);
  const compiled = adaptMaskToFreelandValue(mask, compiledPayload);
  const sdBody = buildSdRequestBody(mask, compiledPayload);

  return {
    mask,
    compiledPayload,
    compiled,
    sdBody,
  };
}

async function generateImageFromMask({ req, rawMask, generateSd }) {
  const compiledState = compileMaskImageGenerate(rawMask);

  if (typeof generateSd !== 'function') {
    const error = new Error('generateSd handler unavailable');
    error.statusCode = 500;
    error.payload = {
      ok: false,
      error: 'sd_unavailable',
      message: 'generateSd handler unavailable',
    };
    throw error;
  }

  const sdResult = await generateSd({
    req,
    prompt: compiledState.sdBody.prompt,
    body: compiledState.sdBody,
  });

  return {
    ...compiledState,
    sdResult,
  };
}

async function generateImageFromText({ req, text, generateSd }) {
  const message = String(text || '').trim();
  if (!message) {
    const error = new Error('missing_message');
    error.statusCode = 400;
    error.payload = { ok: false, error: 'missing_message' };
    throw error;
  }

  const rawMask = buildMaskImageGenerateFromText(message);
  if (!rawMask) {
    const error = new Error('invalid_mask');
    error.statusCode = 400;
    error.payload = {
      ok: false,
      error: 'invalid_mask',
      message: 'Impossible de construire un MASK image.generate a partir du texte fourni.',
    };
    throw error;
  }

  return generateImageFromMask({
    req,
    rawMask,
    generateSd,
  });
}

function resolveGeneratedImageUrl(sdResult) {
  return String(
    sdResult?.image_url
    || sdResult?.url
    || sdResult?.imagePath
    || sdResult?.result?.image_url
    || ''
  ).trim();
}

function buildImageAssistantMessage({ imageUrl, filename }) {
  if (imageUrl && filename) return `C'est fait. L'image est prete. [ouvrir ${filename}](${imageUrl})`;
  if (imageUrl) return `C'est fait. L'image est prete. [ouvrir l'image](${imageUrl})`;
  return "C'est fait. L'image a ete generee.";
}

function toImageChatProxyPayload({ sdResult, mask, compiled, sdBody }) {
  const imageUrl = resolveGeneratedImageUrl(sdResult);
  const filename = String(sdResult?.filename || '').trim();
  const content = buildImageAssistantMessage({ imageUrl, filename });

  return {
    ok: sdResult?.ok !== false,
    id: `a11-img-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'a11-mask-image',
    mode: 'generate_sd',
    tool: 'generate_sd',
    artifact_type: sdResult?.artifact_type || 'image',
    image_url: imageUrl || null,
    imagePath: imageUrl || null,
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
    a11Agent: {
      imagePath: imageUrl || null,
      results: [
        {
          action: 'generate_sd',
          ok: sdResult?.ok !== false,
          result: sdResult,
        },
      ],
    },
    result: sdResult,
    mask,
    compiled,
    sdBody,
  };
}

module.exports = {
  extractLatestUserMessage,
  buildSdRequestBody,
  compileMaskImageGenerate,
  generateImageFromMask,
  generateImageFromText,
  resolveGeneratedImageUrl,
  toImageChatProxyPayload,
};
