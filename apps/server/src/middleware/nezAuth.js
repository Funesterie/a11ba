// Nezlephant auth middleware (CommonJS)
function parseNezTokens(envValue) {
  const map = {};
  if (!envValue) return map;
  // entries separated by ';' with format client=token
  const entries = envValue.split(';').map(s => s.trim()).filter(Boolean);
  for (const entry of entries) {
    const [id, token] = entry.split('=').map(s => (s || '').trim());
    if (id && token) map[id] = token;
  }
  return map;
}

const TOKENS = parseNezTokens(process.env.NEZ_TOKENS);
const MODE = (process.env.NEZ_SECURITY_MODE || 'dev').toLowerCase();

const nezAccessLog = [];

function isLocalRequest(req) {
  try {
    const host = (req.hostname || '').toLowerCase();
    const ip = (req.ip || '').toString();
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (ip === '127.0.0.1' || ip === '::1') return true;
    // also allow if forwarded for contains localhost
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && String(forwarded).includes('127.0.0.1')) return true;
  } catch (e) {}
  return false;
}

function nezAuth(req, res, next) {
  // 1) MODE off => allow all
  if (MODE === 'off') return next();

  // 1.a) If request carries admin header and it matches, allow and mark as admin
  const adminHeader = (req.header('X-NEZ-ADMIN') || '').trim();
  if (adminHeader && process.env.NEZ_ADMIN_TOKEN && adminHeader === process.env.NEZ_ADMIN_TOKEN) {
    // attach admin client info
    req.nezClient = { id: 'admin', token: adminHeader, source: 'admin' };
    try {
      nezAccessLog.push({ when: new Date(), clientId: 'admin', path: req.path, ip: req.ip });
      if (nezAccessLog.length > 500) nezAccessLog.shift();
    } catch (e) {}
    return next();
  }

  // 2) In dev mode, allow local requests when no tokens configured
  if (MODE === 'dev' && isLocalRequest(req) && Object.keys(TOKENS).length === 0) {
    return next();
  }

  const headerToken = (req.header('X-NEZ-TOKEN') || '').trim();
  if (!headerToken) {
    return res.status(403).json({
      error: 'A11_Nezlephant_Filter',
      message: "Nezlephant ne t'a pas encore reconnu sur ce réseau (token manquant).",
    });
  }

  let matchedId = null;
  for (const [id, token] of Object.entries(TOKENS)) {
    if (token === headerToken) {
      matchedId = id;
      break;
    }
  }

  if (!matchedId) {
    return res.status(403).json({
      error: 'A11_Nezlephant_Filter',
      message: 'Nezlephant ne te reconnaît pas (token invalide).',
    });
  }

  // attach nezClient info
  req.nezClient = {
    id: matchedId,
    token: headerToken,
    source: matchedId,
  };

  // push access log
  try {
    nezAccessLog.push({ when: new Date(), clientId: matchedId, path: req.path, ip: req.ip });
    if (nezAccessLog.length > 500) nezAccessLog.shift();
  } catch (e) {}

  next();
}

function getNezAccessLog() {
  return nezAccessLog.slice().reverse();
}

module.exports = { nezAuth, parseNezTokens, TOKENS, MODE, getNezAccessLog };
