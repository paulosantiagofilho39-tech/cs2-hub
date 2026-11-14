// Página inicial. Etapa 1: seções prontas, com estados vazios honestos.
// Etapa 2 substitui o conteúdo por dados reais vindos de /api.
document.addEventListener('DOMContentLoaded', async () => {
  const { emptyState, sectionCard, el } = window.HUB;
  const grid = document.getElementById('home-grid');

  const NOT_YET = 'Os dados reais serão exibidos assim que a integração for conectada.';
  const sections = [
    { title: 'Partidas ao vivo', href: '/matches?status=live', badge: { text: 'AO VIVO', live: true }, cls: 'col-8', icon: '🔴', msg: 'Nenhuma partida ao vivo disponível. ' + NOT_YET },
    { title: 'Campeonatos em destaque', href: '/tournaments', cls: 'col-4', icon: '🏆', msg: NOT_YET },
    { title: 'Próximas partidas', href: '/matches?status=upcoming', cls: 'col-6', icon: '🗓️', msg: NOT_YET },
    { title: 'Últimos resultados', href: '/matches?status=finished', cls: 'col-6', icon: '✅', msg: NOT_YET },
    { title: 'Equipes mais bem ranqueadas', href: '/rankings', cls: 'col-4', icon: '🛡️', msg: NOT_YET },
    { title: 'Jogadores em destaque', href: '/players', cls: 'col-4', icon: '🎯', msg: NOT_YET },
    { title: 'Notícias recentes', href: '/news', cls: 'col-4', icon: '📰', msg: NOT_YET },
  ];

  sections.forEach((s, i) => {
    const card = sectionCard({ ...s, content: emptyState('Sem dados ainda', s.msg, s.icon) });
    card.style.animationDelay = i * 60 + 'ms';
    grid.appendChild(card);
  });

  // Status real das integrações (consulta ao backend; sem chaves expostas).
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
