const defaults = {
  // This placeholder is safe to commit to a public repository.
  homeStop: {
    id: 'REPLACE_WITH_STOP_ID',
    name: 'tu parada'
  },

  // This community HAFAS endpoint includes Munich local transit and live updates
  // when operators provide them. It is not an official MVV API.
  provider: {
    baseUrl: 'https://v6.db.transport.rest',
    requestTimeoutMs: 5000
  },

  // An empty array includes every vehicle. Typical values: ['bus'], ['tram'], ['subway'].
  allowedProducts: ['bus'],

  // Optionally restrict replies to line names, such as ['54', '153'].
  allowedLines: [],
  maxResults: 3,
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

module.exports = {
  ...defaults,
  ...local,
  homeStop: { ...defaults.homeStop, ...local.homeStop },
  provider: { ...defaults.provider, ...local.provider }
};
