'use strict';

// CS2 upcoming matches fetcher using PandaScore's hosted API.
// Used as a SECOND source alongside Liquipedia: PandaScore tends to list
// fixtures earlier, so cross-checking catches matches that Liquipedia
// only records hours before start.
//
// Requires a PandaScore API token (free plan). Provide it via the
// PANDASCORE_TOKEN environment variable or the constructor argument.

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min
const API = 'https://api.pandascore.co/csgo/matches/upcoming';
const { filterMatchesForTeams } = require('./team-name');

let cache = null;
let cacheExpires = 0;

async function fetchUpcoming(token) {
  if (!token) return []; // token missing -> no data, caller falls back
  const now = Date.now();
  if (cache && cacheExpires > now) return cache;

  const url = `${API}?per_page=100&sort=begin_at&token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`PandaScore API ${res.status}`);
  const data = await res.json();

  // Normalize to the same shape Liquipedia's parser produces
  const matches = (Array.isArray(data) ? data : [])
    .filter((m) => m.status === 'not_started' && m.begin_at)
    .map((m) => {
      const teams = (m.opponents || [])
        .map((o) => o?.opponent?.name)
        .filter(Boolean)
        .slice(0, 2);
      const league = m.league?.name || '';
      const tournament = m.tournament?.name || '';
      return {
        kind: 'cs2',
        start: Date.parse(m.begin_at),
        team1: teams[0] || '',
        team2: teams[1] || '',
        tournament: [league, tournament].filter(Boolean).join(' · '),
        title: teams.length === 2 ? `${teams[0]} vs ${teams[1]}` : '',
        source: 'ps',
      };
    })
    .filter((m) => m.team1 && m.team2);

  cache = matches;
  cacheExpires = now + CACHE_TTL_MS;
  return matches;
}

/**
 * Filter matches to those involving any tracked team.
 * @param {Array<string>} trackedTeams
 * @param {string} [token]
 * @returns {Promise<Array>}
 */
async function getMatchesForTeams(trackedTeams, token) {
  const all = await fetchUpcoming(token);
  return filterMatchesForTeams(all, trackedTeams);
}

module.exports = { getMatchesForTeams, fetchUpcoming };
