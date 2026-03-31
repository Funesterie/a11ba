// apps/server/src/tts/normalize-tts-text.cjs
// Normalisation Unicode, correction d’accents, nettoyage de ponctuation

function normalizeTtsText(text) {
  if (!text) return '';
  let out = text.normalize('NFC');
  out = out.replace(/[“”]/g, '"');
  out = out.replace(/[‘’]/g, "'");
  out = out.replace(/\bexecuti\b/gi, 'exécutée');
  out = out.replace(/\bexecutee\b/gi, 'exécutée');
  out = out.replace(/\bexecuted\b/gi, 'exécuté');
  out = out.replace(/\bexecution\b/gi, 'exécution');
  out = out.replace(/\bexecute\b/gi, 'exécute');
  out = out.replace(/\s+/g, ' ');
  out = out.replace(/\s+([,.;!?])/g, '$1');
  return out.trim();
}

module.exports = normalizeTtsText;
