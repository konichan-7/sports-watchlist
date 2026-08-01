'use strict';

// F1 schedule fetcher using the Jolpica API (free Ergast successor).
// Docs: https://api.jolpi.ca/ergast/f1/2026.json
// Returns an Ergast-compatible payload with per-race session times.

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
let cache = null;
let cacheExpires = 0;

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'sports-watchlist/1.0' },
  });
  if (!res.ok) throw new Error(`F1 API ${res.status}: ${url}`);
  return res.json();
}

/**
 * Fetch the full season schedule.
 * @param {number} year - season year (e.g. 2026)
 * @returns {Promise<Array>} array of race objects (Ergast schema)
 */
async function fetchSeason(year) {
  const now = Date.now();
  if (cache && cacheExpires > now) return cache;

  const url = `https://api.jolpi.ca/ergast/f1/${year}.json`;
  const data = await fetchJson(url);
  const races = data?.MRData?.RaceTable?.Races || [];

  cache = races;
  cacheExpires = now + CACHE_TTL_MS;
  return races;
}

/**
 * Normalize a race into a flat list of session events, one per
 * practice / qualifying / sprint / race. Only sessions with a time are kept.
 * @param {object} race - single Ergast race object
 * @returns {Array<object>} normalized session events
 */
function raceToSessions(race) {
  const circuit = race.Circuit?.circuitName || '';
  const country = race.Circuit?.Location?.country || '';
  const base = {
    raceName: race.raceName,
    round: race.round,
    circuit,
    country,
  };

  const sessionDefs = [
    ['FirstPractice', '一练', 'First Practice'],
    ['SecondPractice', '二练', 'Second Practice'],
    ['ThirdPractice', '三练', 'Third Practice'],
    ['SprintQualifying', '冲刺排位赛', 'Sprint Qualifying'],
    ['Qualifying', '排位赛', 'Qualifying'],
    ['Sprint', '冲刺赛', 'Sprint'],
  ];

  const sessions = [];
  for (const [key, zh, en] of sessionDefs) {
    const s = race[key];
    if (s && s.date && s.time) {
      sessions.push({
        ...base,
        kind: 'f1',
        session: key,
        sessionZh: zh,
        sessionEn: en,
        start: toEpochMs(s.date, s.time),
      });
    }
  }

  // Race itself (always present)
  if (race.date && race.time) {
    sessions.push({
      ...base,
      kind: 'f1',
      session: 'Race',
      sessionZh: '正赛',
      sessionEn: 'Race',
      start: toEpochMs(race.date, race.time),
    });
  }

  return sessions;
}

function toEpochMs(dateStr, timeStr) {
  // Ergast gives "YYYY-MM-DD" and "HH:MM:SSZ" (UTC)
  const iso = `${dateStr}T${timeStr}`; // e.g. "2026-03-08T04:00:00Z"
  return Date.parse(iso);
}

/**
 * Public API: return all session events for the season, sorted by time.
 * @param {number} year
 * @returns {Promise<Array>} flattened session events, chronologically
 */
async function getSeasonSessions(year) {
  const races = await fetchSeason(year);
  const sessions = races.flatMap(raceToSessions);
  sessions.sort((a, b) => a.start - b.start);
  return sessions;
}

module.exports = { getSeasonSessions, fetchSeason, raceToSessions };
