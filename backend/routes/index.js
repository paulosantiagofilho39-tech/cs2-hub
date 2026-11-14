const router = require('express').Router();
const system = require('../controllers/systemController');
const data = require('../controllers/dataController');
const { requireAdmin } = require('../middleware/security');

router.get('/health', system.health);

// Dados reais (PandaScore): /api/matches?status=running|upcoming|past
router.get('/matches', data.matches);
router.get('/tournaments', data.tournaments);
router.get('/teams', data.teams);
router.get('/teams/:key', data.team);
router.get('/players', data.players);
router.get('/players/:key', data.player);
router.get('/rankings', data.rankings);

// Cito API (ao vivo)
router.get('/cito/live', data.citoLive);

// Rota administrativa (protegida): status das integrações.
router.get('/admin/providers', requireAdmin, system.providers);

module.exports = router;
