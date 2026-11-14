// Páginas de detalhe: /team/:slug e /player/:slug (dados reais via /api).
document.addEventListener('DOMContentLoaded', async () => {
  const { el, emptyState } = window.HUB;
  const C = window.Cards;
  const kind = document.body.dataset.page; // team | player
  const key = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  const root = document.getElementById('detail');

  const stat = (label, value) => el('div', { class: 'stat' }, [el('span', { class: 'stat-v', text: value }), el('span', { class: 'stat-l', text: label })]);
  const section = (title, node) => el('section', { class: 'card', style: 'margin-top:20px' }, [el('div', { class: 'card-head' }, [el('h2', { text: title })]), node]);
  const fail = (msg) => root.replaceChildren(emptyState('Não encontrado', msg, '🔎'));

  try {
    const res = await fetch(`/api/${kind}s/${encodeURIComponent(key)}`);
    const b = await res.json();
    if (!res.ok) return fail(res.status === 404 ? 'Não encontramos este registro.' : b.error || 'Erro ao carregar.');

    if (kind === 'team') {
      const t = b.team;
      document.title = `${t.name} — ACEZONE`;
      const head = el('div', { class: 'detail-head' }, [
        C.logo(t.logo, t.name, 72),
        el('div', {}, [el('h1', { class: 'page-title', text: t.name }), el('p', { class: 'page-sub', text: C.flag(t.country) + (t.country || 'País não informado') })]),
      ]);
      const r = b.record;
      const stats = el('div', { class: 'stats-row' }, [
        stat('Partidas (recentes)', r.played),
        stat('Vitórias', r.wins),
        stat('Derrotas', r.losses),
        stat('Aproveitamento', r.played ? Math.round((r.wins / r.played) * 100) + '%' : '—'),
      ]);
      const roster = el('div', { class: 'cards-grid' }, t.players.length ? t.players.map((p) => C.playerCard({ ...p, team: null })) : [emptyState('Sem elenco informado', 'A API não retornou jogadores para esta equipe.')]);
      const recent = el('div', { class: 'cards-grid' }, b.recent.length ? b.recent.map(C.matchCard) : [emptyState('Sem partidas recentes', 'Nenhum resultado encontrado.')]);
      root.replaceChildren(head, stats, section('Elenco atual', roster), section('Últimas partidas', recent),
        el('p', { class: 'page-sub', style: 'font-size:.8rem;margin-top:16px', text: `Saldo calculado sobre as últimas ${r.played} partidas encerradas. Aproveitamento por mapa e estatísticas de jogadores ainda não estão disponíveis.` }));
    } else {
      const p = b.player;
      document.title = `${p.name} — ACEZONE`;
      const photo = p.photo ? el('img', { src: p.photo, alt: p.name, width: 96, height: 96, class: 'team-logo avatar' }) : el('span', { class: 'logo-ph avatar big', text: p.name.slice(0, 2).toUpperCase() });
      const full = [p.firstName, p.lastName].filter(Boolean).join(' ');
      const head = el('div', { class: 'detail-head' }, [photo, el('div', {}, [el('h1', { class: 'page-title', text: p.name }), el('p', { class: 'page-sub', text: full || 'Nome completo não informado' })])]);
      const stats = el('div', { class: 'stats-row' }, [
        stat('Nacionalidade', p.nationality ? C.flag(p.nationality) + p.nationality : '—'),
        stat('Função', p.role || '—'),
        stat('Idade', p.age ?? '—'),
        stat('Equipe', p.team ? p.team.name : 'Sem equipe'),
      ]);
      const parts = [head, stats];
      if (p.team) parts.push(section('Equipe atual', el('div', { class: 'cards-grid' }, [C.teamCard({ ...p.team, country: null })])));
      parts.push(el('p', { class: 'page-sub', style: 'font-size:.8rem;margin-top:16px', text: 'Rating, K/D, ADR, KAST e HS% não estão disponíveis no plano atual da fonte de dados.' }));
      root.replaceChildren(...parts);
    }
  } catch {
    fail('Não foi possível carregar agora. Tente novamente em instantes.');
  }
});
