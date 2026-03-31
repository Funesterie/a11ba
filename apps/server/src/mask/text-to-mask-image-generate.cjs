// text-to-mask-image-generate.cjs
// Transforme un message utilisateur en MASK image.generate strict

/**
 * Construit un MASK image.generate à partir d'un message utilisateur.
 * @param {string} message
 * @param {object} [opts] Options additionnelles (style, dimensions, etc.)
 * @returns {object} MASK image.generate
 */
function buildMaskImageGenerateFromText(message, opts = {}) {
  if (typeof message !== 'string' || !message.trim()) return null;
  // Extraction naïve du style et du sujet
  const subject = message.trim();
  const style = opts.style || ["high quality", "detailed"];
  const width = opts.width || 768;
  const height = opts.height || 768;
  const steps = opts.steps || 40;
  const guidance_scale = opts.guidance_scale || 8;
  return {
    version: "mask-1",
    intent: "image.generate",
    task: { domain: "image", action: "generate" },
    compiler: { target: "sd-payload", version: "1.0" },
    inputs: {
      subject: [subject],
      environment: [],
      style,
      composition: [],
      lighting: [],
      palette: []
    },
    options: {
      width,
      height,
      steps,
      guidance_scale
    },
    constraints: {
      safe_mode: true,
      no_text: true
    },
    ambiguities: [],
    raw: message
  };
}

module.exports = buildMaskImageGenerateFromText;
