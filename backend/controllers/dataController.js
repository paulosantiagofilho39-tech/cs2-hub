const ps = require('../services/pandascore');

// Valida e limita parâmetros de entrada.
function parseQuery(req, allowed, fallback) {
  const status = allowed.includes(req.query.status) ? req.query.status : fallback;
  const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 50);
  const perPage = Math.min(Math.max(parseInt(req.query.per_page, 10) || 20, 1), 50);
  return { status, page, perPage };
}

// Cache de CDN: os visitantes não geram consultas à API externa; a Vercel responde pelo cache.
function setCdnCache(res, ttl) {
  res.set('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
}

function handleError(res, err) {
  const status = err.status || 502;
  res.status(status).json({ error: err.message, code: err.code || 'provider_error', items: [] });
}

exports.matches = async (req, res) => {
  const { status, page, perPage } = parseQuery(req, Object.keys(ps.MATCH_STATUS), 'upcoming');
  try {
    const { ttl, items } = await ps.listMatches(status, { page, perPage });
    setCdnCache(res, ttl);
    res.json({ source: 'PandaScore', status, page, items });
  } catch (err) {
    handleError(res, err);
  }
};

exports.tournaments = async (req, res) => {
  const { status, page, perPage } = parseQuery(req, Object.keys(ps.TOURNAMENT_STATUS), 'running');
  try {
    const { ttl, items } = await ps.listTournaments(status, { page, perPage });
    setCdnCache(res, ttl);
    res.json({ source: 'PandaScore', status, page, items });
  } catch (err) {
    handleError(res, err);
  }
};
