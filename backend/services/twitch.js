// Twitch Helix: estado ao vivo e espectadores dos canais. Usa token de app (client credentials).
// O Client Secret fica só no servidor. Dados públicos, sem login de usuário.
const config = require('../config');

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const STREAMS_URL = 'https://api.twitch.tv/helix/streams';
const TIMEOUT_MS = 8000;
const STREAMS_TTL = 60 * 1000; // 1 min: espectadores não precisam de mais precisão

let tokenCache = null; // { token, expires }
let tokenInflight = null;
const streamCache = new Map();

const creds = () => config.providers.twitch;
const isConfigured = () => Boolean(creds().key && creds().clientId);

async function fetchToken() {
  const { clientId, key } = creds();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: key, grant_type: 'client_credentials' }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Twitch token: ${res.status}`);
  const body = await res.json();
  // Renova 5 min antes de expirar.
  tokenCache = { token: body.access_token, expires: Date.now() + Math.max((body.expires_in || 3600) - 300, 60) * 1000 };
  return tokenCache.token;
}

async function getToken(force = false) {
  if (!force && tokenCache && tokenCache.expires > Date.now()) return tokenCache.token;
  if (!tokenInflight) tokenInflight = fetchToken().finally(() => { tokenInflight = null; });
  return tokenInflight;
}

async function callStreams(logins, token) {
  const url = new URL(STREAMS_URL);
  logins.forEach((l) => url.searchParams.append('user_login', l));
  url.searchParams.set('first', '100');
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Client-Id': creds().clientId },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

// logins -> Map(login -> { viewers, title, game }) só com canais ao vivo agora.
async function getLiveStreams(rawLogins) {
  if (!isConfigured()) return new Map();
  const logins = [...new Set(rawLogins.filter((l) => typeof l === 'string' && /^[a-z0-9_]{1,25}$/.test(l)))].sort().slice(0, 100);
  if (!logins.length) return new Map();

  const key = logins.join(',');
  const hit = streamCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;

  let res = await callStreams(logins, await getToken());
  if (res.status === 401) res = await callStreams(logins, await getToken(true)); // token inválido: renova uma vez
  if (!res.ok) {
    if (hit) return hit.data; // dado antigo é melhor que nada
    throw new Error(`Twitch streams: ${res.status}`);
  }
  const body = await res.json();
  const data = new Map();
  for (const s of body.data || []) {
    if (s.type === 'live') data.set(String(s.user_login).toLowerCase(), { viewers: s.viewer_count ?? 0, title: s.title || null, game: s.game_name || null });
  }
  streamCache.set(key, { data, expires: Date.now() + STREAMS_TTL });
  return data;
}

module.exports = { getLiveStreams, isConfigured };
