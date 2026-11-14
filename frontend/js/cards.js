// Renderização de partidas e campeonatos com dados reais da API (/api).
// Todo texto entra via textContent; imagens só https vindas do backend.
(function () {
  const { el, emptyState } = window.HUB;

  const STATUS_LABEL = { running: 'AO VIVO', not_started: 'Em breve', finished: 'Encerrada', canceled: 'Cancelada', postponed: 'Adiada' };

  const fmtDate = (iso) =>
    iso
      ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
      : 'A definir';
  const fmtDay = (iso) => (iso ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—');

  function logo(url, name, size = 28) {
    if (!url) return el('span', { class: 'logo-ph', text: (name || '?').slice(0, 2).toUpperCase() });
    return el('img', { src: url, alt: name || '', width: size, height: size, loading: 'lazy', class: 'team-logo' });
  }

  function teamRow(team, isWinner, showScore) {
    if (!team) return el('div', { class: 'team-row' }, [el('span', { class: 'logo-ph', text: '?' }), el('span', { class: 'team-name', text: 'A definir' })]);
    return el('div', { class: 'team-row' + (isWinner ? ' winner' : '') }, [
      logo(team.logo, team.name),
      el('span', { class: 'team-name', text: team.name }),
      showScore ? el('span', { class: 'team-score', text: team.score ?? '-' }) : null,
    ]);
  }

  function matchCard(m) {
    const live = m.status === 'running';
    const showScore = m.status === 'running' || m.status === 'finished';
    const meta = [m.league?.name, m.serie, m.tournament].filter(Boolean).join(' · ');
    const head = el('div', { class: 'match-head' }, [
      el('span', { class: 'match-meta', text: meta || 'CS2' }),
      el('span', { class: 'badge' + (live ? ' live' : ''), text: live ? STATUS_LABEL.running : STATUS_LABEL[m.status] || m.status }),
    ]);
    const foot = el('div', { class: 'match-foot' }, [
      el('span', { text: m.status === 'finished' && m.endAt ? fmtDate(m.endAt) : fmtDate(m.scheduledAt) }),
      m.bestOf ? el('span', { text: 'MD' + m.bestOf }) : null,
      m.stream ? el('a', { href: m.stream.url, target: '_blank', rel: 'noopener noreferrer', text: 'Assistir ↗' }) : null,
    ]);
    return el('article', { class: 'card match-card' }, [
      head,
      teamRow(m.teams[0], m.winnerId && m.teams[0]?.id === m.winnerId, showScore),
      teamRow(m.teams[1], m.winnerId && m.teams[1]?.id === m.winnerId, showScore),
      foot,
    ]);
  }

  function tournamentCard(t) {
    return el('article', { class: 'card tourn-card' }, [
      logo(t.league?.logo, t.league?.name, 40),
      el('div', {}, [
        el('strong', { text: t.league?.name ? `${t.league.name} — ${t.name}` : t.name }),
        el('div', { class: 'match-meta', text: [t.serie, `${fmtDay(t.beginAt)} → ${fmtDay(t.endAt)}`].filter(Boolean).join(' · ') }),
        t.prizepool ? el('div', { class: 'match-meta', text: 'Premiação: ' + t.prizepool }) : null,
      ]),
    ]);
  }

  // Busca na API do próprio site e preenche o container.
  async function load(url, container, render, emptyMsg, limit) {
    container.replaceChildren(emptyState('Carregando…', 'Buscando dados.', '⏳'));
    try {
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) throw Object.assign(new Error(body.error || 'Erro'), { code: body.code });
      container.replaceChildren();
      const items = limit ? body.items.slice(0, limit) : body.items;
      if (!items.length) return container.appendChild(emptyState('Nada por aqui', emptyMsg));
      items.forEach((i) => container.appendChild(render(i)));
    } catch (e) {
      const notConfigured = e.code === 'provider_not_configured';
      container.replaceChildren(
        emptyState(
          notConfigured ? 'Fonte de dados não configurada' : 'Não foi possível carregar',
          notConfigured ? 'Defina PANDASCORE_TOKEN no servidor.' : 'Tente novamente em instantes.',
          '⚠️'
        )
      );
    }
  }

  window.Cards = { matchCard, tournamentCard, load };
})();
