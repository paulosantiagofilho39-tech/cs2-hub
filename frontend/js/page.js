// Comportamento comum das páginas internas: filtros via URL, busca e conteúdo.
// Dados reais: partidas, campeonatos, equipes, jogadores e ranking. Demais: estado vazio honesto.
document.addEventListener('DOMContentLoaded', () => {
  const { el, emptyState } = window.HUB;
  const C = window.Cards;
  const page = document.body.dataset.page;
  const stage = document.body.dataset.stage;
  const params = new URLSearchParams(location.search);
  const content = document.getElementById('content');

  const LIVE = {
    matches: { param: 'status', fallback: 'upcoming', api: (v) => `/api/matches?status=${v}&per_page=30`, render: () => C.matchCard, empty: 'Nenhuma partida para este filtro.', grid: 'cards-grid' },
    tournaments: { param: 'status', fallback: 'running', api: (v) => `/api/tournaments?status=${v}&per_page=30`, render: () => C.tournamentCard, empty: 'Nenhum campeonato para este filtro.', grid: 'stack' },
    teams: { search: 'Buscar equipe…', api: (v, q) => `/api/teams?q=${encodeURIComponent(q)}`, render: () => C.teamCard, empty: 'Nenhuma equipe encontrada.', grid: 'cards-grid' },
    players: { search: 'Buscar jogador…', api: (v, q) => `/api/players?q=${encodeURIComponent(q)}`, render: () => C.playerCard, empty: 'Nenhum jogador encontrado.', grid: 'cards-grid' },
    maps: { api: () => '/api/maps', render: () => C.mapCard, empty: 'Nenhum mapa disponível.', grid: 'maps-grid' },
    rankings: { param: 'period', fallback: '30d', api: (v) => `/api/rankings?period=${v}`, render: () => C.rankRow, empty: 'Sem dados suficientes neste período.', grid: 'stack', meta: true },
  }[page];

  const box = document.getElementById('filters');
  const filters = JSON.parse(box.dataset.filters || '[]');
  const paramName = LIVE && LIVE.param ? LIVE.param : 'status';
  const valid = filters.map((f) => f[0]);
  let current = valid.includes(params.get(paramName)) ? params.get(paramName) : LIVE && LIVE.fallback ? LIVE.fallback : valid[0];
  let query = (params.get('q') || '').trim();

  function refresh() {
    if (!LIVE) return;
    content.className = 'card';
    const body = el('div', { class: LIVE.grid });
    content.replaceChildren(body);
    if (page === 'matches' && current === 'running') C.loadLive(body);
    else C.load(LIVE.api(current, query), body, LIVE.render(), LIVE.empty);
  }

  filters.forEach(([value, label]) => {
    const chip = el('button', { class: 'chip' + (value === current ? ' active' : ''), type: 'button', text: label });
    chip.addEventListener('click', () => {
      current = value;
      params.set(paramName, value);
      history.replaceState(null, '', '?' + params.toString());
      box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
      refresh();
    });
    box.appendChild(chip);
  });
  if (!filters.length) box.remove();

  if (LIVE && LIVE.search) {
    const input = el('input', { class: 'search wide', type: 'search', placeholder: LIVE.search, 'aria-label': LIVE.search, value: query });
    let t;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        query = input.value.trim();
        query ? params.set('q', query) : params.delete('q');
        history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : ''));
        refresh();
      }, 400);
    });
    content.before(input);
  }

  if (LIVE) return refresh();
  content.appendChild(emptyState('Em breve', 'Esta seção estará disponível em breve.'));
});
