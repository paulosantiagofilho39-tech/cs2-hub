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

// TEMPORÁRIO (exploração): sonda de endpoints da PandaScore, protegida por ADMIN_TOKEN. Será removida.
router.get('/admin/probe', async (req, res) => {
  const { config } = { config: require('../config') };
  const crypto = require('crypto');
  const k = String(req.query.key || '');
  const a = Buffer.from(k), b = Buffer.from(config.adminToken || '');
  if (!config.adminToken || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Não autorizado.' });
  const path = String(req.query.p || '');
  if (!/^\/[a-z0-9_\-\/]{1,120}$/i.test(path)) return res.status(400).json({ error: 'path inválido' });
  const params = {};
  for (const [kk, v] of Object.entries(req.query)) if (kk !== 'key' && kk !== 'p' && kk !== 'path') params[kk] = v;
  try {
    const out = await require('../services/pandascore').request(path, params);
    const text = JSON.stringify(out);
    res.json({ ok: true, count: Array.isArray(out) ? out.length : null, bytes: text.length, sample: Array.isArray(out) ? out.slice(0, Number(req.query.n) || 1) : out });
  } catch (e) {
    res.status(200).json({ ok: false, status: e.status, code: e.code, message: e.message });
  }
});

module.exports = router;
