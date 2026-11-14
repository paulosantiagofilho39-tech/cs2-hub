// Cliente PandaScore (CS2 usa o prefixo /csgo/ na API, por legado).
// Sem banco: cache em memória (por instância) + deduplicação de requisições em voo
// + "stale-on-error". O cache de CDN (s-maxage) é definido nos controllers.
const config = require('../config');

const BASE = 'https://api.pandascore.co';
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;

const cache = new Map(); // key -> { data, expires }
const inflight = new Map(); // key -> Promise

class ProviderError extends Error {
  constructor(message, status = 502, code = 'provider_error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Uma chamada HTTP, com timeout e retentativas com intervalo progressivo (500ms, 1s...).
async function request(path, params) {
  const token = config.providers.pandascore.key;
  if (!token) throw new ProviderError('PandaScore não configurada (PANDASCORE_TOKEN).', 503, 'provider_not_configured');

  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return await res.json();
      if (res.status === 401 || res.status === 403) throw new ProviderError('Token da PandaScore rejeitado.', 502, 'provider_auth');
      if (res.status === 429) throw new ProviderError('Limite de requisições da PandaScore atingido.', 503, 'provider_rate_limited');
      lastErr = new ProviderError(`PandaScore respondeu ${res.status}.`, 502);
      if (res.status < 500) throw lastErr; // 4xx não adianta repetir
    } catch (e) {
      if (e instanceof ProviderError && e.code !== 'provider_error') throw e;
      lastErr = e instanceof ProviderError ? e : new ProviderError('Falha ao consultar a PandaScore.', 502);
    }
    if (attempt < MAX_RETRIES) await sleep(500 * 2 ** attempt);
  }
  throw lastErr;
}

// Busca com cache: várias requisições simultâneas à mesma chave viram uma só.
async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  if (inflight.has(key)) return inflight.get(key);

  const p = loader()
    .then((data) => {
      cache.set(key, { data, expires: Date.now() + ttlMs });
      return data;
    })
    .catch((err) => {
      if (hit) return hit.data; // serve dado antigo se a API falhar
      throw err;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

const httpsOnly = (u) => (typeof u === 'string' && u.startsWith('https://') ? u : null);

// Normaliza uma partida: o frontend nunca depende do formato bruto do provedor.
function normalizeMatch(m) {
  const scoreOf = (teamId) => (m.results || []).find((r) => r.team_id === teamId)?.score ?? null;
  const streams = (m.streams_list || [])
    .filter((s) => httpsOnly(s.raw_url))
    .sort((a, b) => Number(b.main) - Number(a.main) || Number(b.official) - Number(a.official));
  return {
    id: m.id,
    provider: 'pandascore',
    name: m.name,
    status: m.status, // not_started | running | finished | canceled | postponed
    scheduledAt: m.scheduled_at || m.begin_at || null,
    beginAt: m.begin_at || null,
    endAt: m.end_at || null,
    bestOf: m.match_type === 'best_of' ? m.number_of_games : null,
    winnerId: m.winner_id ?? null,
    league: m.league ? { name: m.league.name, logo: httpsOnly(m.league.image_url) } : null,
    serie: m.serie?.full_name || null,
    tournament: m.tournament?.name || null,
    tier: m.tournament?.tier || null,
    teams: (m.opponents || [])
      .filter((o) => o.opponent)
      .map((o) => ({
        id: o.opponent.id,
        slug: o.opponent.slug || null,
        name: o.opponent.name,
        acronym: o.opponent.acronym || null,
        logo: httpsOnly(o.opponent.image_url),
        country: o.opponent.location || null,
        score: scoreOf(o.opponent.id),
      })),
    stream: streams[0] ? { url: streams[0].raw_url, language: streams[0].language || null } : null,
  };
}

function normalizeTournament(t) {
  return {
    id: t.id,
    provider: 'pandascore',
    name: t.name,
    league: t.league ? { name: t.league.name, logo: httpsOnly(t.league.image_url) } : null,
    serie: t.serie?.full_name || null,
    beginAt: t.begin_at || null,
    endAt: t.end_at || null,
    prizepool: t.prizepool || null,
    tier: t.tier || null,
  };
}

// status -> endpoint e TTL (alinhado ao pedido: ao vivo 30s, próximas 5min, resultados 15min, campeonatos 1h)
const MATCH_STATUS = {
  running: { path: '/csgo/matches/running', ttl: 30, sort: 'scheduled_at' },
  upcoming: { path: '/csgo/matches/upcoming', ttl: 300, sort: 'scheduled_at' },
  past: { path: '/csgo/matches/past', ttl: 900, sort: '-begin_at' },
};
const TOURNAMENT_STATUS = {
  running: { path: '/csgo/tournaments/running', ttl: 3600, sort: 'begin_at' },
  upcoming: { path: '/csgo/tournaments/upcoming', ttl: 3600, sort: 'begin_at' },
  past: { path: '/csgo/tournaments/past', ttl: 3600, sort: '-end_at' },
};

async function listMatches(status, { page = 1, perPage = 20 } = {}) {
  const cfg = MATCH_STATUS[status];
  const params = { page, per_page: perPage, sort: cfg.sort };
  const data = await cached(`m:${status}:${page}:${perPage}`, cfg.ttl * 1000, () => request(cfg.path, params));
  return { ttl: cfg.ttl, items: data.map(normalizeMatch) };
}

async function listTournaments(status, { page = 1, perPage = 20 } = {}) {
  const cfg = TOURNAMENT_STATUS[status];
  const params = { page, per_page: perPage, sort: cfg.sort };
  const data = await cached(`t:${status}:${page}:${perPage}`, cfg.ttl * 1000, () => request(cfg.path, params));
  return { ttl: cfg.ttl, items: data.map(normalizeTournament) };
}

// ---------- Equipes e jogadores (plano gratuito: listas, elencos e resultados) ----------

function normalizePlayer(p) {
  return {
    id: p.id,
    slug: p.slug || null,
    name: p.name,
    firstName: p.first_name || null,
    lastName: p.last_name || null,
    nationality: p.nationality || null,
    photo: httpsOnly(p.image_url),
    role: p.role || null,
    age: p.age ?? null,
    team: p.current_team ? { id: p.current_team.id, slug: p.current_team.slug || null, name: p.current_team.name, logo: httpsOnly(p.current_team.image_url) } : null,
  };
}

function normalizeTeam(t) {
  return {
    id: t.id,
    slug: t.slug || null,
    name: t.name,
    acronym: t.acronym || null,
    logo: httpsOnly(t.image_url),
    country: t.location || null,
    players: (t.players || []).map(normalizePlayer),
  };
}

// id numérico ou slug (validado nos controllers) -> filtro da API.
const keyFilter = (key) => (/^\d+$/.test(key) ? { 'filter[id]': key } : { 'filter[slug]': key });

async function searchTeams(q, { page = 1, perPage = 20 } = {}) {
  const params = { 'search[name]': q, page, per_page: perPage, sort: 'name' };
  const data = await cached(`teams:q:${q.toLowerCase()}:${page}:${perPage}`, 3600 * 1000, () => request('/csgo/teams', params));
  return data.map(normalizeTeam);
}

async function getTeam(key) {
  const data = await cached(`team:${key}`, 3600 * 1000, () => request('/csgo/teams', { ...keyFilter(key), per_page: 1 }));
  return data[0] ? normalizeTeam(data[0]) : null;
}

async function searchPlayers(q, { page = 1, perPage = 20 } = {}) {
  const params = { 'search[name]': q, page, per_page: perPage, sort: 'name' };
  const data = await cached(`players:q:${q.toLowerCase()}:${page}:${perPage}`, 3600 * 1000, () => request('/csgo/players', params));
  return data.map(normalizePlayer);
}

async function getPlayer(key) {
  const data = await cached(`player:${key}`, 3600 * 1000, () => request('/csgo/players', { ...keyFilter(key), per_page: 1 }));
  return data[0] ? normalizePlayer(data[0]) : null;
}

async function getTeamsByIds(ids) {
  if (!ids.length) return [];
  const key = `teams:ids:${ids.join(',')}`;
  const data = await cached(key, 3600 * 1000, () => request('/csgo/teams', { 'filter[id]': ids.join(','), per_page: ids.length }));
  return data.map(normalizeTeam);
}

// Últimas partidas encerradas de uma equipe + saldo calculado a partir delas.
async function getTeamMatches(teamId, perPage = 30) {
  const data = await cached(`teamm:${teamId}:${perPage}`, 900 * 1000, () =>
    request('/csgo/matches/past', { 'filter[opponent_id]': teamId, sort: '-begin_at', per_page: perPage })
  );
  const matches = data.map(normalizeMatch);
  const done = matches.filter((m) => m.status === 'finished' && m.winnerId);
  const wins = done.filter((m) => m.winnerId === teamId).length;
  return { matches, record: { played: done.length, wins, losses: done.length - wins } };
}

// ---------- Ranking calculado pelo ACEZONE ----------
// Não existe ranking oficial na API gratuita. Calculamos o aproveitamento (vitórias / partidas)
// a partir de resultados reais. Todas as janelas usam o mesmo conjunto de partidas recentes
// (cache de 6h) e informamos o intervalo realmente coberto.
const RANK_PAGES = 10; // 10 x 100 = até 1000 partidas por atualização
const RANK_TTL = 6 * 3600;
const PERIOD_DAYS = { '7d': 7, '30d': 30, '3m': 90 };

async function loadRecentFinished() {
  const pages = await Promise.all(
    Array.from({ length: RANK_PAGES }, (_, i) =>
      cached(`rank:page:${i + 1}`, RANK_TTL * 1000, () =>
        request('/csgo/matches/past', { sort: '-begin_at', per_page: 100, page: i + 1 })
      )
    )
  );
  return pages.flat().map(normalizeMatch).filter((m) => m.status === 'finished' && m.winnerId && m.teams.length === 2 && m.beginAt);
}

async function teamRanking(period = '30d') {
  const all = await loadRecentFinished();
  const now = Date.now();
  const since = period === 'year' ? new Date(new Date().getFullYear(), 0, 1).getTime() : now - PERIOD_DAYS[period] * 86400000;

  let rows = all.filter((m) => new Date(m.beginAt).getTime() >= since);
  // Prefere torneios de maior nível (S/A/B) quando a API informa o nível; senão usa todos.
  const top = rows.filter((m) => ['s', 'a', 'b'].includes(String(m.tier).toLowerCase()));
  const useTop = top.length >= 30;
  if (useTop) rows = top;

  const table = new Map();
  for (const m of rows) {
    for (const t of m.teams) {
      const e = table.get(t.id) || { team: { id: t.id, slug: t.slug, name: t.name, logo: t.logo, country: t.country }, wins: 0, losses: 0 };
      if (m.winnerId === t.id) e.wins++;
      else e.losses++;
      table.set(t.id, e);
    }
  }
  const minPlayed = period === '7d' ? 3 : 5;
  const items = [...table.values()]
    .map((e) => ({ ...e, played: e.wins + e.losses, winRate: Math.round((e.wins / (e.wins + e.losses)) * 1000) / 10 }))
    .filter((e) => e.played >= minPlayed)
    .sort((a, b) => b.winRate - a.winRate || b.played - a.played)
    .slice(0, 50)
    .map((e, i) => ({ position: i + 1, ...e }));

  const times = all.map((m) => new Date(m.beginAt).getTime());
  return {
    ttl: RANK_TTL,
    items,
    meta: {
      method: 'Aproveitamento (vitórias ÷ partidas) calculado pelo ACEZONE com resultados reais da PandaScore.',
      period,
      minMatches: minPlayed,
      matchesUsed: rows.length,
      tiers: useTop ? 'S/A/B' : 'todos',
      dataFrom: times.length ? new Date(Math.min(...times)).toISOString() : null,
      dataTo: times.length ? new Date(Math.max(...times)).toISOString() : null,
    },
  };
}

module.exports = {
  listMatches, listTournaments, searchTeams, getTeam, searchPlayers, getPlayer, getTeamsByIds, getTeamMatches, teamRanking,
  MATCH_STATUS, TOURNAMENT_STATUS, PERIOD_DAYS, ProviderError,
};
