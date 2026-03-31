function normalizeMessageForIntent(message) {
  return String(message || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Détection d'intention pour génération d'image (FR/EN)
function detectImageIntent(message) {
  if (!message || typeof message !== 'string') return false;

  const normalized = normalizeMessageForIntent(message);
  if (!normalized) return false;

  const patterns = [
    /\b(genere|generer|generation|generee|generee|genere-moi|cree|creer|dessine|dessiner|fais|faire|fabrique|produis|produire|prepare|preparer)\b.*\b(image|illustration|dessin|photo|visuel|visu|art)\b/i,
    /\b(image|illustration|drawing|picture|photo|visual|art|generate|create|draw|make|produce)\b.*\b(cat|dog|scene|city|robot|animal|person|character|landscape|object|thing|photo|picture|illustration|drawing|art)\b/i,
    /\b(generate|create|draw|make|produce)\b.*\b(image|illustration|drawing|picture|photo|visual|art)\b/i,
    /\b(genere|cree|dessine|fabrique|produis|prepare)\s+(moi\s+)?(une\s+)?image\b/i,
    /\b(genere|cree|dessine|fabrique|produis|prepare)\s+(moi\s+)?(un\s+|une\s+)?(portrait|visuel|dessin|illustration|photo)\b/i,
  ];

  if (patterns.some((re) => re.test(normalized))) {
    return true;
  }

  const hasVisualWord = /\b(image|illustration|dessin|photo|visuel|portrait|art)\b/.test(normalized);
  const hasCreationVerb = /\b(genere|generee|cree|dessine|fabrique|produis|prepare|make|create|draw|generate)\b/.test(normalized);
  return hasVisualWord && hasCreationVerb;
}

// Détection "montre-moi une image de X" (image réelle web)
function detectWebImageIntent(message) {
  if (!message || typeof message !== 'string') return false;
  // Ex: "montre-moi une image de Goku"
  return /montre(-| )?moi (une|un)? ?image de ([^\?\.\!]+)/i.test(message);
}

function extractWebImageSubject(message) {
  if (!message || typeof message !== 'string') return null;
  const m = message.match(/montre(-| )?moi (une|un)? ?image de ([^\?\.\!]+)/i);
  if (m && m[3]) return m[3].trim();
  return null;
}

module.exports = { detectImageIntent, detectWebImageIntent, extractWebImageSubject };
