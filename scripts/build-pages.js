// Gera as páginas internas a partir de um template único (evita duplicação).
// Uso: node scripts/build-pages.js
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'frontend', 'pages');

const PAGES = {
  matches: {
    title: 'Partidas', sub: 'Acompanhe partidas ao vivo, próximas e encerradas.',
    filters: [['running', 'Ao vivo'], ['upcoming', 'Próximas'], ['past', 'Encerradas']],
    stage: 2,
  },
  players: { title: 'Jogadores', sub: 'Perfis de jogadores profissionais de CS2.', stage: 3 },
  teams: { title: 'Equipes', sub: 'Elenco, país e histórico de partidas das equipes de CS2.', stage: 3 },
  tournaments: {
    title: 'Campeonatos', sub: 'Premiação, datas e organizadoras dos campeonatos de CS2.',
    filters: [['running', 'Em andamento'], ['upcoming', 'Próximos'], ['past', 'Encerrados']],
    stage: 2,
  },
  rankings: {
    title: 'Rankings', sub: 'Jogadores, equipes, desempenho individual e aproveitamento por mapa.',
    filters: [['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'], ['3m', 'Últimos 3 meses'], ['year', 'Ano atual']],
    stage: 3,
  },
  stats: { title: 'Estatísticas avançadas', sub: 'Rating, K/D, ADR, KAST, HS%, first kills, clutches e lado CT/TR.', stage: 4 },
  maps: { title: 'Mapas', sub: 'Os mapas do pool competitivo de CS2.', stage: 4 },
  news: { title: 'Notícias', sub: 'Transferências, mudanças de elenco e resultados.', stage: 5 },
};

const template = (key, p) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${p.title} — ACEZONE</title>
  <meta name="description" content="${p.sub}">
  <meta name="theme-color" content="#0d0e10">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/img/icon-32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/img/icon-192.png">
  <link rel="apple-touch-icon" href="/img/icon-180.png">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body data-page="${key}" data-stage="${p.stage}">
  <header class="site-header" id="site-header"></header>
  <main>
    <div class="container">
      <h1 class="page-title">${p.title}</h1>
      <p class="page-sub">${p.sub}</p>
      <div class="filters" id="filters" data-filters='${JSON.stringify(p.filters || [])}'></div>
      ${p.note ? `<p class="page-sub" style="font-size:.85rem">${p.note}</p>` : ''}
      <section class="card" id="content"></section>
    </div>
  </main>
  <footer class="site-footer" id="site-footer"></footer>
  <script src="/js/components.js"></script>
  <script src="/js/cards.js"></script>
  <script src="/js/page.js"></script>
</body>
</html>
`;

// Páginas de detalhe (/team/:slug e /player/:slug): título e conteúdo são preenchidos por js/detail.js.
const detailTemplate = (key, title) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — ACEZONE</title>
  <meta name="description" content="${title} de Counter-Strike 2 no ACEZONE.">
  <meta name="theme-color" content="#0d0e10">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/img/icon-32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/img/icon-192.png">
  <link rel="apple-touch-icon" href="/img/icon-180.png">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body data-page="${key}">
  <header class="site-header" id="site-header"></header>
  <main>
    <div class="container" id="detail"></div>
  </main>
  <footer class="site-footer" id="site-footer"></footer>
  <script src="/js/components.js"></script>
  <script src="/js/cards.js"></script>
  <script src="/js/detail.js"></script>
</body>
</html>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'team.html'), detailTemplate('team', 'Equipe'));
fs.writeFileSync(path.join(OUT, 'player.html'), detailTemplate('player', 'Jogador'));
for (const [key, p] of Object.entries(PAGES)) {
  fs.writeFileSync(path.join(OUT, `${key}.html`), template(key, p));
}
console.log(`${Object.keys(PAGES).length} páginas geradas em ${OUT}`);
