const { getProvidersStatus } = require('../services/providers');

exports.health = (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()), time: new Date().toISOString() });
};

exports.providers = (req, res) => {
  res.json({ providers: getProvidersStatus() });
};
