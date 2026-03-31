// compile-mask-to-sd.cjs
// Compile MASK image.generate -> raw Stable Diffusion payload (prompt + params)

/**
 * Compile a validated MASK (image.generate) to a raw SD payload
 * @param {object} mask
 * @returns {object} Raw SD payload (prompt, negative_prompt, width, height, steps, guidance_scale, etc.)
 */
function joinField(arr, label) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return label ? `${label}: ${arr.join(', ')}` : arr.join(', ');
}

function compileMaskToSD(mask) {
  if (mask?.intent !== 'image.generate') {
    throw new Error('MASK intent must be image.generate');
  }
  const promptSections = [
    joinField(mask.inputs?.subject, 'Subject'),
    joinField(mask.inputs?.environment, 'Environment'),
    joinField(mask.inputs?.style, 'Style'),
    joinField(mask.inputs?.composition, 'Composition'),
    joinField(mask.inputs?.lighting, 'Lighting'),
    joinField(mask.inputs?.palette, 'Palette'),
  ].filter(s => typeof s === 'string' && s.length > 0);
  const prompt = promptSections.join('. ');

  // Negative prompt: if constraints.no_text, add 'text, letters, watermark' etc.
  let negativePrompt = '';
  if (mask.constraints?.no_text) {
    negativePrompt = 'text, letters, watermark, signature, logo';
  }
  // Add more negative prompt logic if needed (e.g., from ambiguities)

  const sdPayload = {
    prompt,
    negative_prompt: negativePrompt,
    width: mask.options?.width,
    height: mask.options?.height,
    steps: mask.options?.steps,
    guidance_scale: mask.options?.guidance_scale,
  };
  if (typeof mask.options?.seed === 'number') sdPayload.seed = mask.options.seed;
  if (typeof mask.options?.sampler === 'string') sdPayload.sampler = mask.options.sampler;

  return sdPayload;
}

module.exports = compileMaskToSD;
