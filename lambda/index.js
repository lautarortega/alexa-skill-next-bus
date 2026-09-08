const Alexa = require('ask-sdk-core');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const config = require('./config');

function isStopConfigured() {
  return config.homeStop && config.homeStop.id && !config.homeStop.id.startsWith('REPLACE_');
}

function requestJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const request = client.get(url, {
      headers: { 'user-agent': 'mi-bus-munich-alexa-skill/1.0' }
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Departure provider returned HTTP ${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Departure provider returned invalid JSON'));
        }
      });
    });

    request.setTimeout(timeoutMs, () => request.destroy(new Error('Departure provider timed out')));
    request.on('error', reject);
  });
}

function departureUrl() {
  const url = new URL('/api/bgw-pt/v3/departures', config.provider.baseUrl);
  url.searchParams.set('globalId', config.homeStop.id);
  url.searchParams.set('results', String(config.maxResults * 4));
  url.searchParams.set('limit', String(config.maxResults * 4));

  const transportTypes = {
    bus: 'BUS',
    tram: 'TRAM',
    subway: 'UBAHN',
    suburban: 'SBAHN'
  };

  if (config.allowedProducts.length === 1 && transportTypes[config.allowedProducts[0]]) {
    url.searchParams.set('transportTypes', transportTypes[config.allowedProducts[0]]);
  }

  return url;
}

function productOf(departure) {
  const product = departure.line && departure.line.product || departure.product || departure.transportType || '';
  const products = {
    BUS: 'bus',
    TRAM: 'tram',
    UBAHN: 'subway',
    SBAHN: 'suburban'
  };

  return products[product] || String(product).toLowerCase();
}

function lineNameOf(departure) {
  return String(departure.line && (departure.line.name || departure.line.fahrtNr) || departure.lineName || departure.label || '').trim();
}

function allowedDeparture(departure) {
  const product = productOf(departure);
  const lineName = lineNameOf(departure);
  const products = config.allowedProducts.map((item) => item.toLowerCase());

  return (!products.length || products.includes(product))
    && (!config.allowedLines.length || config.allowedLines.includes(lineName));
}

async function getDepartures(getJson = requestJson) {
  const result = await getJson(departureUrl(), config.provider.requestTimeoutMs);
  const departures = Array.isArray(result) ? result : result.departures;

  if (!Array.isArray(departures)) {
    throw new Error('Departure provider returned an unexpected response');
  }

  return departures
    .filter(allowedDeparture)
    .map((departure) => ({
      line: lineNameOf(departure),
      direction: departure.direction || departure.destination || 'sin destino indicado',
      when: departure.when || departure.prognosedWhen || departure.realtimeDepartureTime || departure.plannedWhen || departure.plannedDepartureTime,
      plannedWhen: departure.plannedWhen || departure.plannedDepartureTime,
      delay: Number.isFinite(departure.delay)
        ? departure.delay
        : Number.isFinite(departure.realtimeDepartureTime) && Number.isFinite(departure.plannedDepartureTime)
          ? Math.round((departure.realtimeDepartureTime - departure.plannedDepartureTime) / 1000)
          : null,
      cancelled: Boolean(departure.cancelled)
    }))
    .filter((departure) => departure.when && !departure.cancelled)
    .sort((a, b) => new Date(a.when) - new Date(b.when))
    .slice(0, config.maxResults);
}

function minutesUntil(when, now = new Date()) {
  return Math.max(0, Math.ceil((new Date(when).getTime() - now.getTime()) / 60000));
}

function minutePhrase(minutes) {
  return minutes === 0 ? 'ahora' : `en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
}

function timeAt(when) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: config.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(when));
}

function speechForDepartures(departures, now = new Date()) {
  if (!departures.length) {
    return `No encontré próximos servicios configurados en ${config.homeStop.name}.`;
  }

  const [next, following] = departures;
  const delay = next.delay > 0 ? ` Tiene un retraso de ${Math.round(next.delay / 60)} minutos.` : '';
  let speech = `El próximo ${next.line ? `bus ${next.line}` : 'bus'} hacia ${next.direction} pasa ${minutePhrase(minutesUntil(next.when, now))}, a las ${timeAt(next.when)}.${delay}`;

  if (following) {
    speech += ` El siguiente, ${following.line ? `el bus ${following.line}` : 'el bus'} hacia ${following.direction}, pasa ${minutePhrase(minutesUntil(following.when, now))}, a las ${timeAt(following.when)}.`;
  }

  return speech;
}

async function departureResponse(handlerInput) {
  if (!isStopConfigured()) {
    return handlerInput.responseBuilder
      .speak('Aún no configuraste la parada. Edita el identificador de parada en el archivo de configuración y vuelve a desplegar la skill.')
      .getResponse();
  }

  try {
    const departures = await getDepartures();
    return handlerInput.responseBuilder.speak(speechForDepartures(departures)).getResponse();
  } catch (error) {
    console.error('Unable to retrieve departures', error);
    return handlerInput.responseBuilder
      .speak('No pude consultar las salidas en este momento. Inténtalo de nuevo en unos minutos.')
      .getResponse();
  }
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  async handle(handlerInput) {
    const userId = handlerInput.requestEnvelope.session && handlerInput.requestEnvelope.session.user.userId;
    if (userId === 'alexa-lambda-availability') {
      return handlerInput.responseBuilder.getResponse();
    }

    return departureResponse(handlerInput);
  }
};

const NextDepartureIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'NextDepartureIntent';
  },
  async handle(handlerInput) {
    return departureResponse(handlerInput);
  }
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Pregunta: cuándo pasa el próximo bus, colectivo o bondi.')
      .reprompt('Pregunta: cuándo pasa el próximo colectivo.')
      .getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && ['AMAZON.CancelIntent', 'AMAZON.StopIntent'].includes(Alexa.getIntentName(handlerInput.requestEnvelope));
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.speak('Hasta luego.').getResponse();
  }
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('No entendí. Pregunta cuándo pasa el próximo bus, colectivo o bondi.')
      .reprompt('Pregunta: cuándo pasa el próximo colectivo.')
      .getResponse();
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error(`Skill error: ${error.message}`, error);
    return handlerInput.responseBuilder
      .speak('Lo siento, tuve un problema. Inténtalo de nuevo.')
      .reprompt('Pregunta cuándo pasa el próximo colectivo.')
      .getResponse();
  }
};

const skill = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    NextDepartureIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();

module.exports = {
  handler: skill,
  getDepartures,
  minutesUntil,
  speechForDepartures
};
