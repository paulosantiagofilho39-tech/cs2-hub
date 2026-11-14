// Página inicial: dados reais da PandaScore (via /api) + estados vazios honestos
// para seções que ainda não têm fonte (ranking, jogadores, notícias).
document.addEventListener('DOMContentLoaded', async () => {
  const { emptyState, sectionCard, el } = window.HUB;
  const { matchCard, tournamentCard, load } = window.Cards;
  const grid = document.getElementById('home-grid');

  const NOT_YET = 'Esta seção será ativada em uma próxima etapa.';
  heroPlayer(document.getElementById('hero-player'));

  const sections = [
    { title: 'Partidas ao vivo', href: '/matches?status=running', badge: { text: 'AO VIVO', live: true }, cls: 'col-8', live: true, list: 'cards-grid', limit: 6 },
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
    if (s.live) window.Cards.loadLive(body, s.limit);
    else if (s.url) load(s.url, body, s.render, s.empty, s.limit);
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


// Player principal da home: já começa a transmitir (sem som) a partida ao vivo mais assistida.
async function heroPlayer(box) {
  const { el } = window.HUB;
  const { embedUrl, PLATFORM } = window.Cards;
  if (!box) return;
  try {
    const res = await fetch('/api/cito/live');
    const body = await res.json();
    if (!res.ok) throw new Error();
    const matches = (body.items || [])
      .filter((m) => (m.streams || []).some((s) => embedUrl(s)))
      .sort((a, b) => ((b.twitch && b.twitch.viewers) || 0) - ((a.twitch && a.twitch.viewers) || 0));
    if (!matches.length) throw new Error('none');

    const frame = el('div', { class: 'hero-frame' });
    const caption = el('div', { class: 'hero-caption' });
    const picker = el('div', { class: 'player-tabs' });
    let cur = -1;

    function show(i) {
      cur = i;
      const m = matches[i];
      const s = m.streams
        .filter((x) => embedUrl(x))
        .sort((a, b) => Number(!!b.live) - Number(!!a.live) || (b.viewers || 0) - (a.viewers || 0))[0];
      frame.replaceChildren(el('iframe', { src: embedUrl(s, true), allow: 'autoplay; fullscreen; picture-in-picture', allowfullscreen: '', referrerpolicy: 'strict-origin-when-cross-origin', title: 'Transmissão ao vivo' }));
      const score = m.teams.map((t) => t.seriesScore ?? '-').join(' – ');
      caption.replaceChildren(
        el('span', { class: 'badge live', text: 'AO VIVO' }),
        el('strong', { text: m.teams[0].name + ' × ' + m.teams[1].name + '  ' + score }),
        el('span', { class: 'match-meta', text: (m.event.name || 'CS2') + ' · ' + (PLATFORM[s.platform] || s.platform) + (m.twitch ? ' · 👁 ' + m.twitch.viewers.toLocaleString('pt-BR') : '') }),
        el('span', { class: 'match-meta', text: 'Sem som — use o controle do player para ativar.' })
      );
      [...picker.children].forEach((b, j) => b.classList.toggle('active', j === i));
    }
    matches.slice(0, 5).forEach((m, i) => {
      const b = el('button', { type: 'button', class: 'chip', text: m.teams[0].name + ' × ' + m.teams[1].name });
      b.addEventListener('click', () => show(i));
      picker.appendChild(b);
    });
    box.replaceChildren(frame, caption, picker);
    show(0);
  } catch {
    box.replaceChildren(el('div', { class: 'hero-empty' }, [
      el('strong', { text: 'Nenhuma transmissão ao vivo agora' }),
      el('span', { class: 'match-meta', text: 'Assim que uma partida com transmissão começar, ela passa aqui automaticamente.' }),
    ]));
  }
}
