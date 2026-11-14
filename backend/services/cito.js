// Cliente da Cito API (https://api.citoapi.com). Autenticação: cabeçalho "x-api-key".
// Endpoint usado: GET /api/v1/cs2/live (partidas em andamento).
// Mesmo padrão do cliente PandaScore: cache curto, deduplicação, retentativas progressivas.
const config = require('../config');

const BASE = 'https://api.citoapi.com';
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const cache = new Map();
const inflight = new Map();

class CitoError extends Error {
  constructor(message, status = 502, code = 'provider_error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(path) {
  const key = config.providers.cito.key;
  if (!key) throw new CitoError('Cito API não configurada (CITO_API_KEY).', 503, 'provider_not_configured');

  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(BASE + path, {
        headers: { 'x-api-key': key, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return await res.json();
      if (res.status === 401 || res.status === 403) throw new CitoError('Chave da Cito API rejeitada.', 502, 'provider_auth');
      if (res.status === 429) {
        lastErr = new CitoError('Limite de requisições da Cito API atingido.', 503, 'provider_rate_limited');
        const wait = Math.min(Number(res.headers.get('retry-after')) * 1000 || 1000 * (attempt + 1), 3000);
        if (attempt < MAX_RETRIES) { await sleep(wait); continue; }
        throw lastErr;
      }
      lastErr = new CitoError(`Cito API respondeu ${res.status}.`, 502);
      if (res.status < 500) throw lastErr;
    } catch (e) {
      if (e instanceof CitoError && e.code !== 'provider_error') throw e;
      lastErr = e instanceof CitoError ? e : new CitoError('Falha ao consultar a Cito API.', 502);
    }
    if (attempt < MAX_RETRIES) await sleep(500 * 2 ** attempt);
  }
  throw lastErr;
}

async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  if (inflight.has(key)) return inflight.get(key);
  const p = loader()
    .then((data) => { cache.set(key, { data, expires: Date.now() + ttlMs }); return data; })
    .catch((err) => { if (hit) return hit.data; throw err; })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// O plano gratuito entrega dados com 60s de atraso, então consultar com mais frequência não ajuda
// e só gasta cota: 30s de cache.
const LIVE_TTL = 30; // segundos

// Primeiro trecho do caminho da URL (twitch.tv/<canal>); null se não houver.
function channelOf(url) {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean)[0];
    return seg && /^[A-Za-z0-9_]{1,25}$/.test(seg) ? seg.toLowerCase() : null;
  } catch {
    return null;
  }
}

const httpsOnly = (u) => (typeof u === 'string' && u.startsWith('https://') ? u : null);

// Normaliza uma partida ao vivo: o frontend não depende do formato bruto do provedor.
function normalizeLive(m) {
  const t = m.teams || {};
  const side = (k) => (m.ctTeam === k ? 'CT' : m.tTeam === k ? 'TR' : null);
  const links = (m.streamLinks || []).filter((l) => httpsOnly(l.url));
  const official = m.streams && m.streams.official && httpsOnly(m.streams.official.url);
  // Todas as transmissões (https) com o canal extraído da URL; a Twitch é consultada depois.
  const streams = links.slice(0, 8).map((l) => ({
    platform: String(l.platform || '').toLowerCase() || null,
    url: l.url,
    channel: channelOf(l.url),
  }));
  const team = (k) => ({
    name: t[`${k}Name`] || m[`${k}Name`] || 'A definir',
    logo: t[`${k}LogoIsPlaceholder`] ? null : httpsOnly(t[`${k}LogoUrl`]),
    seriesScore: m.score?.[k] ?? m[`${k}Score`] ?? null, // mapas vencidos
    mapScore: m.currentMapScore?.[k] ?? null, // rounds no mapa atual
    side: side(k), // CT | TR
  });
  return {
    id: m.matchId || m.id,
    status: m.status,
    event: { name: m.eventName || null, logo: httpsOnly(m.eventLogoUrl) },
    bestOf: m.bestOf ?? null,
    startsAt: m.startsAt || null,
    map: m.currentMap ? String(m.currentMap).replace(/^de_/, '') : null,
    round: m.currentRound ?? null,
    updatedAt: m.latestSnapshotAt || null,
    teams: [team('team1'), team('team2')],
    stream: official ? { url: official } : links[0] ? { url: links[0].url } : null,
    streams,
  };
}

async function getLive() {
  const body = await cached('live', LIVE_TTL * 1000, () => request('/api/v1/cs2/live'));
  const list = Array.isArray(body?.data) ? body.data : [];
  return { ttl: LIVE_TTL, delaySeconds: body?.delayed?.delay_seconds ?? 0, items: list.map(normalizeLive) };
}

module.exports = { getLive, CitoError };
