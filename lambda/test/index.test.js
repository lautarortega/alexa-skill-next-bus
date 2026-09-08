const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../config');
const { getDepartures, minutesUntil, speechForDepartures } = require('../index');

const originalConfig = JSON.parse(JSON.stringify(config));

function restoreConfig() {
  Object.assign(config, JSON.parse(JSON.stringify(originalConfig)));
}

test.afterEach(restoreConfig);

test('filters only the configured transport and returns them chronologically', async () => {
  config.homeStop.id = '123';
  config.allowedProducts = ['bus'];
  config.allowedLines = [];
  config.maxResults = 3;

  const departures = await getDepartures(async () => [
    { line: { name: 'U3', product: 'subway' }, direction: 'Moosach', when: '2026-09-07T10:10:00.000Z' },
    { line: { name: '54', product: 'bus' }, direction: 'Lorettoplatz', when: '2026-09-07T10:07:00.000Z', delay: 120 },
    { line: { name: '53', product: 'bus' }, direction: 'Münchner Freiheit', when: '2026-09-07T10:05:00.000Z' },
    { line: { name: '54', product: 'bus' }, direction: 'Cancelled', when: '2026-09-07T10:04:00.000Z', cancelled: true }
  ]);

  assert.deepEqual(departures.map((departure) => departure.line), ['53', '54']);
});

test('normalizes a real-time MVG departure response', async () => {
  config.homeStop.id = 'de:09162:336';
  config.allowedProducts = ['bus'];

  const departures = await getDepartures(async () => [{
    transportType: 'BUS',
    label: '178',
    destination: 'Freimanner Hölzl',
    plannedDepartureTime: 1788857340000,
    realtimeDepartureTime: 1788857460000,
    cancelled: false
  }]);

  assert.deepEqual(departures, [{
    line: '178',
    direction: 'Freimanner Hölzl',
    when: 1788857460000,
    plannedWhen: 1788857340000,
    delay: 120,
    cancelled: false
  }]);
});

test('rounds future departures up to the next minute', () => {
  const now = new Date('2026-09-07T10:00:10.000Z');
  assert.equal(minutesUntil('2026-09-07T10:04:11.000Z', now), 5);
  assert.equal(minutesUntil('2026-09-07T09:59:00.000Z', now), 0);
});

test('builds a concise Spanish response with live delay information', () => {
  config.homeStop.name = 'Casa';
  const now = new Date('2026-09-07T10:00:00.000Z');
  const speech = speechForDepartures([
    { line: '54', direction: 'Lorettoplatz', when: '2026-09-07T10:06:00.000Z', delay: 120 },
    { line: '53', direction: 'Münchner Freiheit', when: '2026-09-07T10:15:00.000Z', delay: 0 }
  ], now);

  assert.match(speech, /bus 54 hacia Lorettoplatz pasa en 6 minutos/);
  assert.match(speech, /retraso de 2 minutos/);
  assert.match(speech, /El siguiente, el bus 53 hacia Münchner Freiheit, pasa en 15 minutos, a las 12:15/);
});
