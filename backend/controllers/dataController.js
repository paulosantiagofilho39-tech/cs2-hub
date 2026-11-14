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

// ---------- Equipes, jogadores e ranking ----------
const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,80}$/; // id ou slug
const cleanQ = (q) => String(q || '').trim().slice(0, 40);

exports.teams = async (req, res) => {
  const q = cleanQ(req.query.q);
  try {
    if (q.length >= 2) {
      const items = await ps.searchTeams(q, { perPage: 24 });
      setCdnCache(res, 3600);
      return res.json({ source: 'PandaScore', q, items });
    }
    if (q) return res.json({ source: 'PandaScore', q, items: [] });
    // Sem busca: equipes com melhor aproveitamento recente (cálculo do ACEZONE).
    const r = await ps.teamRanking('30d');
    setCdnCache(res, r.ttl);
    res.json({ source: 'PandaScore', q: '', note: 'Equipes em destaque pelo aproveitamento recente.', items: r.items.slice(0, 24).map((i) => i.team) });
  } catch (err) {
    handleError(res, err);
  }
};

exports.team = async (req, res) => {
  const key = req.params.key;
  if (!KEY_RE.test(key)) return res.status(400).json({ error: 'Identificador inválido.' });
  try {
    const team = await ps.getTeam(key);
    if (!team) return res.status(404).json({ error: 'Equipe não encontrada.' });
    const { matches, record } = await ps.getTeamMatches(team.id, 30);
    setCdnCache(res, 900);
    res.json({ source: 'PandaScore', team, record, recent: matches.slice(0, 10) });
  } catch (err) {
    handleError(res, err);
  }
};

exports.players = async (req, res) => {
  const q = cleanQ(req.query.q);
  try {
    if (q.length >= 2) {
      const items = await ps.searchPlayers(q, { perPage: 24 });
      setCdnCache(res, 3600);
      return res.json({ source: 'PandaScore', q, items });
    }
    if (q) return res.json({ source: 'PandaScore', q, items: [] });
    // Sem busca: jogadores dos elencos das equipes em destaque.
    const r = await ps.teamRanking('30d');
    const teams = await ps.getTeamsByIds(r.items.slice(0, 10).map((i) => i.team.id));
    const items = teams.flatMap((t) => t.players.map((p) => ({ ...p, team: { id: t.id, slug: t.slug, name: t.name, logo: t.logo } })));
    setCdnCache(res, 3600);
    res.json({ source: 'PandaScore', q: '', note: 'Jogadores das equipes em destaque.', items });
  } catch (err) {
    handleError(res, err);
  }
};

exports.player = async (req, res) => {
  const key = req.params.key;
  if (!KEY_RE.test(key)) return res.status(400).json({ error: 'Identificador inválido.' });
  try {
    const player = await ps.getPlayer(key);
    if (!player) return res.status(404).json({ error: 'Jogador não encontrado.' });
    setCdnCache(res, 3600);
    res.json({ source: 'PandaScore', player });
  } catch (err) {
    handleError(res, err);
  }
};

exports.rankings = async (req, res) => {
  const period = ['7d', '30d', '3m', 'year'].includes(req.query.period) ? req.query.period : '30d';
  try {
    const r = await ps.teamRanking(period);
    setCdnCache(res, r.ttl);
    res.json({ source: 'PandaScore (calculado pelo ACEZONE)', ...r.meta, items: r.items });
  } catch (err) {
    handleError(res, err);
  }
};

// ---------- Cito API (ao vivo) ----------
const cito = require('../services/cito');

exports.citoLive = async (req, res) => {
  try {
    const { ttl, delaySeconds, items } = await cito.getLive();
    setCdnCache(res, ttl);
    res.json({ source: 'Cito API', delaySeconds, items });
  } catch (err) {
    handleError(res, err);
  }
};
