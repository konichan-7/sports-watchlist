'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  fetchCs2MatchesForTeams,
} = require('../lib/events');

test('uses an available CS2 source when another source is rate limited', async (t) => {
  const warnings = [];
  t.mock.method(console, 'warn', (message) => warnings.push(message));

  const pandaScoreMatch = {
    team1: 'Spirit',
    team2: 'Vitality',
    start: Date.UTC(2026, 7, 30, 12),
    source: 'ps',
  };
  const matches = await fetchCs2MatchesForTeams(['Spirit'], 'token', [
    {
      name: 'Liquipedia',
      load: async () => { throw new Error('Liquipedia API 429'); },
    },
    {
      name: 'PandaScore',
      load: async () => [pandaScoreMatch],
    },
  ]);

  assert.deepEqual(matches, [pandaScoreMatch]);
  assert.deepEqual(warnings, ['[CS2] Liquipedia unavailable: Liquipedia API 429']);
});

test('fails when every configured CS2 source fails', async (t) => {
  t.mock.method(console, 'warn', () => {});

  await assert.rejects(
    fetchCs2MatchesForTeams(['Spirit'], 'token', [
      {
        name: 'Liquipedia',
        load: async () => { throw new Error('Liquipedia API 429'); },
      },
      {
        name: 'PandaScore',
        load: async () => { throw new Error('PandaScore API 503'); },
      },
    ]),
    /All configured CS2 schedule sources failed/
  );
});
