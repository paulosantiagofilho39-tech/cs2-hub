const router = require('express').Router();
const system = require('../controllers/systemController');
const { requireAdmin } = require('../middleware/security');

router.get('/health', system.health);

// Rota administrativa (protegida): status das integrações.
router.get('/admin/providers', requireAdmin, system.providers);

module.exports = router;
