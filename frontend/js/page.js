// Comportamento comum das páginas internas: filtros via URL e conteúdo.
// /matches e /tournaments usam dados reais; as demais mostram estado vazio honesto.
document.addEventListener('DOMContentLoaded', () => {
  const { el, emptyState } = window.HUB;
  const page = document.body.dataset.page;
  const stage = document.body.dataset.stage;
  const params = new URLSearchParams(location.search);
  const content = document.getElementById('content');

  // Cada página: parâmetro de filtro, valor padrão e endpoint (quando houver dados reais).
  const LIVE = {
    matches: { param: 'status', fallback: 'upcoming', api: (v) => `/api/matches?status=${v}&per_page=30`, render: () => window.Cards.matchCard, empty: 'Nenhuma partida para este filtro.', grid: 'cards-grid' },
    tournaments: { param: 'status', fallback: 'running', api: (v) => `/api/tournaments?status=${v}&per_page=30`, render: () => window.Cards.tournamentCard, empty: 'Nenhum campeonato para este filtro.', grid: 'stack' },
  }[page];

  const box = document.getElementById('filters');
  const filters = JSON.parse(box.dataset.filters || '[]');
  const paramName = LIVE ? LIVE.param : page === 'rankings' ? 'period' : 'status';
  const valid = filters.map((f) => f[0]);
  const current = valid.includes(params.get(paramName)) ? params.get(paramName) : LIVE ? LIVE.fallback : valid[0];

  function refresh(value) {
    if (!LIVE) return;
    content.className = 'card';
    const body = el('div', { class: LIVE.grid });
    content.replaceChildren(body);
    window.Cards.load(LIVE.api(value), body, LIVE.render(), LIVE.empty);
  }

  filters.forEach(([value, label]) => {
    const chip = el('button', { class: 'chip' + (value === current ? ' active' : ''), type: 'button', text: label });
    chip.addEventListener('click', () => {
      params.set(paramName, value);
      history.replaceState(null, '', '?' + params.toString());
      box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
      refresh(value);
    });
    box.appendChild(chip);
  });
  if (!filters.length) box.remove();

  // Mapas: lista dos 8 mapas competitivos (sem estatísticas inventadas).
  const mapsBox = document.getElementById('maps-grid');
  if (mapsBox) {
    JSON.parse(mapsBox.dataset.maps).forEach((name) => {
      mapsBox.appendChild(el('div', { class: 'card map-card' }, [document.createTextNode(name), el('small', { text: 'Estatísticas em breve' })]));
    });
  }

  if (LIVE) return refresh(current);

  const q = params.get('q');
  const msg = q ? `Busca por "${q}": a pesquisa real será ativada em breve.` : `Esta seção receberá dados reais na Etapa ${stage}.`;
  content.appendChild(emptyState('Sem dados ainda', msg));
});
