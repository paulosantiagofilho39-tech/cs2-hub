// Registro dos provedores de dados. Etapa 1: apenas status de configuração.
// Os clientes reais (PandaScore, FACEIT...) entram nas Etapas 2 e 3 após
// conferência da documentação oficial de cada API.
const config = require('../config');

const STAGE = { pandascore: 2, faceit: 3, grid: 4, cito: 4 };

function getProvidersStatus() {
  return Object.entries(config.providers).map(([id, p]) => ({
    id,
    name: p.name,
    configured: Boolean(p.key), // nunca retornar a chave
    plannedStage: STAGE[id],
    integrated: id === 'pandascore' || id === 'cito',
  }));
}

module.exports = { getProvidersStatus };
