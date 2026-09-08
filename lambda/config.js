const defaults = {
  // This placeholder is safe to commit to a public repository.
  homeStop: {
    id: 'REPLACE_WITH_STOP_ID',
    name: 'tu parada'
  },

  // MVG's public departure endpoint returns planned and real-time departure times.
  // It is an undocumented endpoint, so it may change without notice.
  provider: {
    baseUrl: 'https://www.mvg.de',
    requestTimeoutMs: 5000
  },

  // An empty array includes every vehicle. Typical values: ['bus'], ['tram'], ['subway'].
  allowedProducts: ['bus'],

  // Optionally restrict replies to line names, such as ['54', '153'].
  allowedLines: [],
  maxResults: 2,
  lookAheadMinutes: 120,
  timeZone: 'Europe/Berlin'
};

let local = {};

try {
  // This file is ignored by Git and is only for local development.
  local = require('./config.local');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND' || !error.message.includes('config.local')) {
    throw error;
  }
}

module.exports = Object.assign({}, defaults, local, {
  homeStop: Object.assign({}, defaults.homeStop, local.homeStop),
  provider: Object.assign({}, defaults.provider, local.provider)
});
