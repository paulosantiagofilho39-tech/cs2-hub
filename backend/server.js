// ACEZONE - servidor Express: API em /api + frontend estático.
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const config = require('./config');
const routes = require('./routes');
const { apiLimiter, notFound, errorHandler } = require('./middleware/security');

const app = express();
const FRONTEND = path.join(__dirname, '..', 'frontend');

app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", 'https://cdn.jsdelivr.net'],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        // Players embutidos (Twitch, Kick, YouTube)
        'frame-src': ['https://player.twitch.tv', 'https://player.kick.com', 'https://www.youtube.com'],
        'style-src': ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
      },
    },
  })
);
app.use(compression());
app.use(cors({ origin: config.corsOrigins.length ? config.corsOrigins : false }));
app.use(express.json({ limit: '100kb' }));

// API
app.use('/api', apiLimiter, routes);
app.use('/api', notFound);

// Frontend estático
app.use(express.static(FRONTEND, { extensions: ['html'], maxAge: config.env === 'production' ? '1h' : 0 }));

// URLs amigáveis: /matches -> pages/matches.html
const PAGES = ['matches', 'players', 'teams', 'tournaments', 'rankings', 'stats', 'maps', 'news'];
PAGES.forEach((p) => app.get(`/${p}`, (req, res) => res.sendFile(path.join(FRONTEND, 'pages', `${p}.html`))));
// URLs amigáveis de detalhe: /team/vitality, /player/zywoo
app.get('/team/:slug', (req, res) => res.sendFile(path.join(FRONTEND, 'pages', 'team.html')));
app.get('/player/:slug', (req, res) => res.sendFile(path.join(FRONTEND, 'pages', 'player.html')));

app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => console.log(`ACEZONE em http://localhost:${config.port}`));
}

module.exports = app;
