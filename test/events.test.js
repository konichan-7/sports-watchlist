'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  fetchCs2MatchesForTeams,
  preserveHistoricalEvents,
  calendarEventsFrom,
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

test('preserves completed calendar events from the previous deployment', () => {
  const now = Date.UTC(2026, 7, 29, 12);
  const current = [{
    uid: 'current',
    start: now + 1000,
    end: now + 2000,
    inCalendar: true,
  }];
  const historical = {
    uid: 'historical',
    start: now - 2000,
    end: now - 1000,
    inCalendar: true,
  };
  const merged = preserveHistoricalEvents(current, [
    historical,
    { ...current[0], start: now - 3000, end: now - 2000 },
    { uid: 'old-practice', start: now - 2000, end: now - 1000, inCalendar: false },
    { uid: 'stale-future', start: now + 3000, end: now + 4000, inCalendar: true },
  ], now);

  assert.deepEqual(merged, [historical, current[0]]);
});

test('includes completed events in the calendar subscription', () => {
  const completed = {
    uid: 'completed',
    kind: 'cs2',
    title: 'Spirit vs Vitality',
    subtitle: 'Test tournament',
    team1: 'Spirit',
    team2: 'Vitality',
    tournament: 'Test tournament',
    start: Date.UTC(2026, 7, 28, 12),
    end: Date.UTC(2026, 7, 28, 14),
    inCalendar: true,
  };

  assert.deepEqual(calendarEventsFrom([completed]), [{
    uid: completed.uid,
    summary: 'CS2 Spirit vs Vitality · Test tournament',
    description: 'Spirit vs Vitality — Test tournament',
    start: completed.start,
    end: completed.end,
    location: undefined,
    reminderMin: 60,
  }]);
});
