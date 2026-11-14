// Componentes reutilizáveis (header, footer, cards, estado vazio).
// Usa DOM seguro: textos entram via textContent, nunca innerHTML com dados externos.
(function () {
  const NAV = [
    ['/matches', 'Partidas'],
    ['/players', 'Jogadores'],
    ['/teams', 'Equipes'],
    ['/tournaments', 'Campeonatos'],
    ['/rankings', 'Rankings'],
    ['/stats', 'Estatísticas'],
    ['/maps', 'Mapas'],
    ['/news', 'Notícias'],
  ];

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = v;
      else node.setAttribute(k, v);
    }
    [].concat(children).forEach((c) => c && node.appendChild(c));
    return node;
  }

  function renderHeader(target) {
    const path = location.pathname.replace(/\/$/, '');
    const nav = el('nav', { class: 'nav', id: 'nav', 'aria-label': 'Principal' },
      NAV.map(([href, label]) => {
        const a = el('a', { href, text: label });
        if (path === href) a.classList.add('active');
        return a;
      })
    );
    const logo = el('a', { href: '/', class: 'logo', 'aria-label': 'CS2 HUB - início' });
    logo.append('CS2 ');
    logo.appendChild(el('span', { text: 'HUB' }));

    const search = el('input', { class: 'search', type: 'search', placeholder: 'Buscar jogador ou equipe…', 'aria-label': 'Buscar' });
    // Busca funcional: redireciona para a página de jogadores com o termo (consulta real na Etapa 3).
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && search.value.trim()) {
        location.href = '/players?q=' + encodeURIComponent(search.value.trim());
      }
    });

    const btn = el('button', { class: 'menu-btn', 'aria-label': 'Abrir menu', 'aria-expanded': 'false', text: '☰' });
    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });

    target.appendChild(el('div', { class: 'container header-inner' }, [logo, nav, search, btn]));
  }

  function renderFooter(target) {
    const links = el('nav', {}, NAV.map(([href, label]) => el('a', { href, text: label })));
    target.appendChild(el('div', { class: 'container footer-inner' }, [
      el('span', { text: '© ' + new Date().getFullYear() + ' CS2 HUB — projeto independente, sem vínculo com Valve ou bo3.gg.' }),
      links,
    ]));
  }

  // Estado vazio padrão: usado quando ainda não há dados reais.
  function emptyState(title, message, icon = '📡') {
    return el('div', { class: 'empty' }, [
      el('div', { class: 'ico', text: icon }),
      el('strong', { text: title }),
      el('span', { text: message }),
    ]);
  }

  // Card de seção com título e link opcional.
  function sectionCard({ title, href, badge, content, cls = 'col-6' }) {
    const head = el('div', { class: 'card-head' }, [
      el('h2', { text: title }),
      badge ? el('span', { class: 'badge ' + (badge.live ? 'live' : ''), text: badge.text }) : null,
      href ? el('a', { href, text: 'Ver tudo →' }) : null,
    ]);
    return el('section', { class: 'card ' + cls }, [head, content]);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const h = document.getElementById('site-header');
    const f = document.getElementById('site-footer');
    if (h) renderHeader(h);
    if (f) renderFooter(f);
  });

  window.HUB = { el, emptyState, sectionCard, NAV };
})();
