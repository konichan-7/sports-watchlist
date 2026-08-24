'use strict';

/**
 * Normalize the harmless differences used by CS2 data providers while keeping
 * team identity exact. For example, Liquipedia may use "Spirit" while another
 * provider uses "Team Spirit".
 *
 * Deliberately do not use substring matching here: "Spirit" must not match
 * "HyperSpirit" or "Spirit Academy".
 *
 * @param {string} name
 * @returns {string}
 */
function normalizeTeamName(name) {
  return String(name || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^team\s+/, '');
}

/**
 * Return whether a provider team name is the tracked team.
 * @param {string} actualName
 * @param {string} trackedName
 * @returns {boolean}
 */
function isSameTeam(actualName, trackedName) {
  const actual = normalizeTeamName(actualName);
  const tracked = normalizeTeamName(trackedName);
  return Boolean(actual && tracked && actual === tracked);
}

/**
 * Filter matches to those involving any tracked team.
 * @param {Array<object>} matches
 * @param {Array<string>} trackedTeams
 * @returns {Array<object>}
 */
function filterMatchesForTeams(matches, trackedTeams) {
  return matches.filter((match) =>
    trackedTeams.some((tracked) =>
      isSameTeam(match.team1, tracked) || isSameTeam(match.team2, tracked)
    )
  );
}

module.exports = { normalizeTeamName, isSameTeam, filterMatchesForTeams };
