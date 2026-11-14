// Configuração central: lê variáveis de ambiente uma única vez.
require('dotenv').config();

const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  corsOrigins: list(process.env.CORS_ORIGINS),
  adminToken: process.env.ADMIN_TOKEN || '',
  // Provedores: "configured" indica se a chave existe (nunca expomos o valor).
  providers: {
    pandascore: { name: 'PandaScore', key: process.env.PANDASCORE_TOKEN || '' },
    faceit: { name: 'FACEIT Data API', key: process.env.FACEIT_API_KEY || '' },
    grid: { name: 'GRID', key: process.env.GRID_API_KEY || '' },
    cito: { name: 'Cito API', key: process.env.CITO_API_KEY || '' },
    // Twitch: key = Client Secret (só no servidor); clientId identifica o app.
    twitch: { name: 'Twitch', key: process.env.TWITCH_CLIENT_SECRET || '', clientId: process.env.TWITCH_CLIENT_ID || '' },
  },
};
