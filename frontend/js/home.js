// Página inicial: dados reais da PandaScore (via /api) + estados vazios honestos
// para seções que ainda não têm fonte (ranking, jogadores, notícias).
document.addEventListener('DOMContentLoaded', async () => {
  const { emptyState, sectionCard, el } = window.HUB;
  const { matchCard, tournamentCard, load } = window.Cards;
  const grid = document.getElementById('home-grid');

  const NOT_YET = 'Esta seção será ativada em uma próxima etapa.';
  const sections = [
    { title: 'Partidas ao vivo', href: '/matches?status=running', badge: { text: 'AO VIVO', live: true }, cls: 'col-8', url: '/api/matches?status=running&per_page=6', render: matchCard, empty: 'Nenhuma partida ao vivo no momento.', list: 'cards-grid' },
    { title: 'Campeonatos em destaque', href: '/tournaments', cls: 'col-4', url: '/api/tournaments?status=running&per_page=5', render: tournamentCard, empty: 'Nenhum campeonato em andamento.', list: 'stack' },
    { title: 'Próximas partidas', href: '/matches?status=upcoming', cls: 'col-6', url: '/api/matches?status=upcoming&per_page=6', render: matchCard, empty: 'Nenhuma partida agendada.', list: 'cards-grid' },
    { title: 'Últimos resultados', href: '/matches?status=past', cls: 'col-6', url: '/api/matches?status=past&per_page=6', render: matchCard, empty: 'Sem resultados recentes.', list: 'cards-grid' },
    { title: 'Equipes mais bem ranqueadas', href: '/rankings', cls: 'col-4', url: '/api/rankings?period=30d', render: window.Cards.rankRow, empty: 'Sem dados suficientes.', list: 'stack', limit: 5 },
    { title: 'Jogadores em destaque', href: '/players', cls: 'col-4', url: '/api/players', render: window.Cards.playerCard, empty: 'Nenhum jogador disponível.', list: 'stack', limit: 5 },
    { title: 'Notícias recentes', href: '/news', cls: 'col-4', icon: '📰' },
  ];

  sections.forEach((s, i) => {
    const body = el('div', { class: s.list || '' });
    const card = sectionCard({ ...s, content: body });
    card.style.animationDelay = i * 60 + 'ms';
    grid.appendChild(card);
    if (s.url) load(s.url, body, s.render, s.empty, s.limit);
    else body.appendChild(emptyState('Em breve', NOT_YET, s.icon));
  });

  const box = document.getElementById('api-status');
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    box.appendChild(el('div', { class: 'status-row' }, [
      el('span', {}, [el('i', { class: 'dot ok' }), document.createTextNode('Backend')]),
      el('span', { text: data.status === 'ok' ? 'Online' : 'Indisponível' }),
    ]));
  } catch {
    box.appendChild(el('div', { class: 'status-row' }, [el('span', { text: 'Backend' }), el('span', { text: 'Offline' })]));
  }
});
