// Middlewares de segurança: rate limiting, auth admin e tratamento de erros.
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const config = require('../config');

// Limite geral da API: protege contra abuso sem afetar uso normal.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' },
});

// Comparação em tempo constante para evitar timing attacks.
function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Protege rotas administrativas via header "Authorization: Bearer <ADMIN_TOKEN>".
function requireAdmin(req, res, next) {
  if (!config.adminToken) {
    return res.status(503).json({ error: 'Rotas administrativas desativadas (ADMIN_TOKEN não configurado).' });
  }
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !safeEqual(token, config.adminToken)) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }
  next();
}

function notFound(req, res) {
  res.status(404).json({ error: 'Rota não encontrada.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[erro]', err.message);
  res.status(err.status || 500).json({ error: config.env === 'production' ? 'Erro interno.' : err.message });
}

module.exports = { apiLimiter, requireAdmin, notFound, errorHandler };
