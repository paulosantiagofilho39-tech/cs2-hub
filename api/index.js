// Entrada serverless do Vercel: reaproveita o app Express (rotas /api/*).
// O frontend estático é servido pelo próprio Vercel (outputDirectory: frontend).
module.exports = require('../backend/server');
