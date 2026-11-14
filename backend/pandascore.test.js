// Testes do cliente PandaScore com fetch simulado (nenhuma chamada real).
const test = require('node:test');
const assert = require('node:assert');

const sample = [{
  id: 1, name: 'Final', status: 'finished', scheduled_at: '2026-01-01T10:00:00Z', begin_at: '2026-01-01T10:05:00Z',
  end_at: '2026-01-01T11:00:00Z', match_type: 'best_of', number_of_games: 3, winner_id: 10,
  opponents: [{ opponent: { id: 10, name: 'Alpha', image_url: 'https://x/a.png' } }, { opponent: { id: 20, name: 'Beta', image_url: 'http://insecure/b.png' } }],
  results: [{ team_id: 10, score: 2 }, { team_id: 20, score: 1 }],
  league: { name: 'Liga', image_url: 'https://x/l.png' }, serie: { full_name: 'S1 2026' }, tournament: { name: 'Playoffs' },
  streams_list: [{ raw_url: 'https://twitch.tv/x', main: true, official: true, language: 'en' }],
}];

test('normaliza partidas, usa Bearer e deduplica chamadas simultâneas', async () => {
  process.env.PANDASCORE_TOKEN = 'tok';
  let calls = 0, auth, url;
  global.fetch = async (u, opts) => { calls++; url = String(u); auth = opts.headers.Authorization; return { ok: true, status: 200, json: async () => sample }; };
  const ps = require('./services/pandascore');
  const [a, b] = await Promise.all([ps.listMatches('past'), ps.listMatches('past')]);
  assert.strictEqual(calls, 1);
  assert.strictEqual(auth, 'Bearer tok');
  assert.match(url, /\/csgo\/matches\/past\?/);
  const m = a.items[0];
  assert.strictEqual(m.teams[0].score, 2);
  assert.strictEqual(m.teams[1].logo, null); // http bloqueado
  assert.strictEqual(m.bestOf, 3);
  assert.strictEqual(m.stream.url, 'https://twitch.tv/x');
  await ps.listMatches('past'); // cache
  assert.strictEqual(calls, 1);
});

test('sem token retorna provider_not_configured', async () => {
  delete require.cache[require.resolve('./services/pandascore')];
  delete require.cache[require.resolve('./config')];
  delete process.env.PANDASCORE_TOKEN;
  const ps = require('./services/pandascore');
  await assert.rejects(ps.listMatches('running'), (e) => e.code === 'provider_not_configured');
});

test('ranking calcula aproveitamento, ignora partidas sem vencedor e respeita o mínimo', async () => {
  process.env.PANDASCORE_TOKEN = 'tok';
  delete require.cache[require.resolve('./services/pandascore')];
  delete require.cache[require.resolve('./config')];
  const recent = new Date(Date.now() - 86400000).toISOString();
  const mk = (id, winner) => ({
    id, status: 'finished', begin_at: recent, end_at: recent, match_type: 'best_of', number_of_games: 3, winner_id: winner,
    opponents: [{ opponent: { id: 1, slug: 'alpha', name: 'Alpha' } }, { opponent: { id: 2, slug: 'beta', name: 'Beta' } }],
    results: [], tournament: { name: 'T', tier: 'a' },
  });
  // 6 partidas: Alpha vence 5 e perde 1; uma partida cancelada sem vencedor deve ser ignorada
  const page1 = [mk(1, 1), mk(2, 1), mk(3, 1), mk(4, 1), mk(5, 1), mk(6, 2), { ...mk(7, null), status: 'canceled' }];
  global.fetch = async (u) => ({ ok: true, status: 200, json: async () => (new URL(String(u)).searchParams.get('page') === '1' ? page1 : []) });
  const ps = require('./services/pandascore');
  const r = await ps.teamRanking('7d');
  assert.strictEqual(r.items.length, 2);
  assert.strictEqual(r.items[0].team.name, 'Alpha');
  assert.strictEqual(r.items[0].wins, 5);
  assert.strictEqual(r.items[0].winRate, 83.3);
  assert.strictEqual(r.items[0].position, 1);
  assert.strictEqual(r.meta.matchesUsed, 6);
});

test('Cito: usa x-api-key e retorna provider_not_configured sem chave', async () => {
  delete process.env.CITO_API_KEY;
  for (const m of ['./services/cito', './config']) delete require.cache[require.resolve(m)];
  let cito = require('./services/cito');
  await assert.rejects(cito.getLive(), (e) => e.code === 'provider_not_configured');

  process.env.CITO_API_KEY = 'k123';
  for (const m of ['./services/cito', './config']) delete require.cache[require.resolve(m)];
  let seen;
  const raw = { data: [{ matchId: 'm1', status: 'live', eventName: 'Ev', eventLogoUrl: 'https://x/l.webp', bestOf: 3,
    teams: { team1Name: 'A', team1LogoUrl: 'https://x/a.webp', team2Name: 'B', team2LogoUrl: 'http://bad/b.webp' },
    score: { team1: 1, team2: 0 }, currentMapScore: { team1: 8, team2: 4 }, currentMap: 'de_mirage', currentRound: 13,
    ctTeam: 'team2', tTeam: 'team1', streams: { official: { url: 'https://twitch.tv/x' } } }], delayed: { delay_seconds: 60 } };
  global.fetch = async (u, o) => { seen = { url: String(u), key: o.headers['x-api-key'] }; return { ok: true, status: 200, json: async () => raw }; };
  cito = require('./services/cito');
  const r = await cito.getLive();
  assert.strictEqual(seen.url, 'https://api.citoapi.com/api/v1/cs2/live');
  assert.strictEqual(seen.key, 'k123');
  assert.strictEqual(r.delaySeconds, 60);
  const m = r.items[0];
  assert.strictEqual(m.map, 'mirage');
  assert.strictEqual(m.teams[0].mapScore, 8);
  assert.strictEqual(m.teams[0].side, 'TR');
  assert.strictEqual(m.teams[1].side, 'CT');
  assert.strictEqual(m.teams[1].logo, null); // http bloqueado
  assert.strictEqual(m.stream.url, 'https://twitch.tv/x');
});

test('Twitch: token de app, Client-Id, só canais ao vivo, cache e renovação em 401', async () => {
  process.env.TWITCH_CLIENT_ID = 'cid';
  process.env.TWITCH_CLIENT_SECRET = 'sec';
  for (const m of ['./services/twitch', './config']) delete require.cache[require.resolve(m)];
  const calls = [];
  let streamsCalls = 0;
  global.fetch = async (u, o = {}) => {
    const url = String(u);
    calls.push(url);
    if (url.startsWith('https://id.twitch.tv/oauth2/token')) {
      assert.match(String(o.body), /grant_type=client_credentials/);
      assert.match(String(o.body), /client_secret=sec/);
      return { ok: true, status: 200, json: async () => ({ access_token: 'T' + calls.length, expires_in: 5000000 }) };
    }
    streamsCalls++;
    assert.strictEqual(o.headers['Client-Id'], 'cid');
    if (streamsCalls === 1) return { ok: false, status: 401, json: async () => ({}) }; // força renovação
    assert.match(o.headers.Authorization, /^Bearer T/);
    return { ok: true, status: 200, json: async () => ({ data: [{ type: 'live', user_login: 'eslcs', viewer_count: 1234 }] }) };
  };
  const tw = require('./services/twitch');
  const live = await tw.getLiveStreams(['eslcs', 'offline_one', 'BAD NAME']);
  assert.strictEqual(live.get('eslcs').viewers, 1234);
  assert.strictEqual(live.has('offline_one'), false);
  assert.ok(String(calls.find((c) => c.includes('helix/streams'))).includes('user_login=eslcs'));
  const before = calls.length;
  await tw.getLiveStreams(['eslcs', 'offline_one']); // cache
  assert.strictEqual(calls.length, before);
});

test('Twitch: sem credenciais retorna vazio sem chamar a rede', async () => {
  delete process.env.TWITCH_CLIENT_SECRET;
  for (const m of ['./services/twitch', './config']) delete require.cache[require.resolve(m)];
  global.fetch = async () => { throw new Error('não deveria chamar'); };
  const tw = require('./services/twitch');
  assert.strictEqual((await tw.getLiveStreams(['eslcs'])).size, 0);
});
