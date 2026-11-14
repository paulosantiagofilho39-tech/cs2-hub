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

const LIVE_TTL = 15; // segundos

// Resposta bruta por enquanto: a normalização será feita após conferir o formato real.
async function getLive() {
  const data = await cached('live', LIVE_TTL * 1000, () => request('/api/v1/cs2/live'));
  return { ttl: LIVE_TTL, data };
}

module.exports = { getLive, CitoError };
