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
