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
    teams: (m.opponents || [])
      .filter((o) => o.opponent)
      .map((o) => ({
        id: o.opponent.id,
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

module.exports = { listMatches, listTournaments, MATCH_STATUS, TOURNAMENT_STATUS, ProviderError };
