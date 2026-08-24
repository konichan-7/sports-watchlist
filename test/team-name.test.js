'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeTeamName,
  isSameTeam,
  filterMatchesForTeams,
} = require('../lib/team-name');

test('normalizes Team Spirit provider aliases', () => {
  assert.equal(normalizeTeamName('Team Spirit'), 'spirit');
  assert.equal(normalizeTeamName('  SPIRIT  '), 'spirit');
  assert.equal(isSameTeam('Spirit', 'Team Spirit'), true);
});

test('does not confuse Team Spirit with teams containing Spirit', () => {
  assert.equal(isSameTeam('HyperSpirit', 'Team Spirit'), false);
  assert.equal(isSameTeam('Spirit Academy', 'Team Spirit'), false);
});

test('only keeps matches involving the main Team Spirit roster', () => {
  const matches = [
    { team1: 'Spirit', team2: 'Vitality' },
    { team1: 'HyperSpirit', team2: 'MOUZ' },
    { team1: 'Spirit Academy', team2: 'NAVI Junior' },
  ];

  assert.deepEqual(filterMatchesForTeams(matches, ['Team Spirit']), [matches[0]]);
});
