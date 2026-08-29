'use strict';

// Shared event-assembly logic, used by both the local server (server.js) and
// the static build script (scripts/build-static.js).

const f1 = require('./f1');
const cs2 = require('./cs2');
const pandascore = require('./pandascore');
const ics = require('./ics');
const store = require('./store');

// CS2 match dedup: same teams + same day from two sources is the same match.
function sameMatch(a, b) {
  const aTeams = [a.team1, a.team2].map((t) => t.toLowerCase()).sort().join('~');
  const bTeams = [b.team1, b.team2].map((t) => t.toLowerCase()).sort().join('~');
  if (aTeams !== bTeams) return false;
  return Math.abs(a.start - b.start) < 6 * 60 * 60 * 1000; // same day (±6h)
}

function mergeCs2Matches(lp, ps) {
  const merged = [...lp];
  for (const p of ps) {
    if (!merged.some((m) => sameMatch(m, p))) merged.push(p);
  }
  return merged;
}

/**
 * Carry completed calendar events forward from the previously published
 * dataset. Upcoming events always come from the current providers so schedule
 * changes and cancellations can still be reflected.
 *
 * @param {Array<object>} currentEvents
 * @param {Array<object>} previousEvents
 * @param {number} [now]
 * @returns {Array<object>}
 */
function preserveHistoricalEvents(currentEvents, previousEvents, now = Date.now()) {
  const merged = [...currentEvents];
  const seenUids = new Set(currentEvents.map((event) => event.uid));

  for (const event of previousEvents) {
    if (!event || !event.uid || seenUids.has(event.uid)) continue;
    if (event.inCalendar !== true || !Number.isFinite(event.end) || event.end > now) continue;
    merged.push(event);
    seenUids.add(event.uid);
  }

  merged.sort((a, b) => a.start - b.start);
  return merged;
}

/**
 * Fetch configured CS2 sources independently. A temporary failure in one
 * provider must not discard valid data from the other provider.
 *
 * @param {Array<string>} trackedTeams
 * @param {string} [token]
 * @param {Array<{name:string, load:Function}>} [sourceOverrides]
 * @returns {Promise<Array<object>>}
 */
async function fetchCs2MatchesForTeams(trackedTeams, token, sourceOverrides) {
  const sources = sourceOverrides || [
    {
      name: 'Liquipedia',
      load: () => cs2.getMatchesForTeams(trackedTeams),
    },
    ...(token ? [{
      name: 'PandaScore',
      load: () => pandascore.getMatchesForTeams(trackedTeams, token),
    }] : []),
  ];

  const results = await Promise.allSettled(
    sources.map((source) => Promise.resolve().then(source.load))
  );
  const availableMatches = [];
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      availableMatches.push(result.value);
      return;
    }

    const source = sources[index];
    errors.push(result.reason);
    console.warn(`[CS2] ${source.name} unavailable: ${result.reason?.message || result.reason}`);
  });

  if (availableMatches.length === 0) {
    throw new AggregateError(errors, 'All configured CS2 schedule sources failed');
  }

  return availableMatches.reduce(
    (merged, matches) => mergeCs2Matches(merged, matches),
    []
  );
}

// Sessions that go into the calendar feed (practice stays on the web page only)
const F1_CALENDAR_SESSIONS = new Set(['Qualifying', 'Race']);
const F1_DURATIONS = {
  FirstPractice: 60, SecondPractice: 60, ThirdPractice: 60,
  SprintQualifying: 45, Qualifying: 60, Sprint: 60, Race: 120,
};
const CS2_DURATION_MIN = 150; // Bo3 ~2.5h

function f1Uid(year, round, session) {
  return `f1-${year}-r${round}-${session}`;
}

function cs2Uid(match) {
  return `cs2-${match.start}-${match.team1}-${match.team2}`;
}

/**
 * Build the unified event list for the web frontend.
 * @returns {Promise<Array<object>>}
 */
async function buildEvents() {
  const trackers = store.getTrackers();
  const events = [];

  const f1Tracker = trackers.find((t) => t.type === 'f1');
  const cs2Teams = trackers.filter((t) => t.type === 'cs2').map((t) => t.team);

  if (f1Tracker) {
    const year = store.getF1Year();
    const sessions = await f1.getSeasonSessions(year);
    for (const s of sessions) {
      const inCalendar = F1_CALENDAR_SESSIONS.has(s.session);
      events.push({
        uid: f1Uid(year, s.round, s.session),
        kind: 'f1',
        title: s.raceName,
        subtitle: s.sessionZh,
        session: s.session,
        round: s.round,
        circuit: s.circuit,
        country: s.country,
        start: s.start,
        end: s.start + F1_DURATIONS[s.session] * 60 * 1000,
        inCalendar,
        trackerId: f1Tracker.id,
        trackerLabel: f1Tracker.label,
      });
    }
  }

  if (cs2Teams.length > 0) {
    // Two sources: Liquipedia (default) + PandaScore (earlier fixtures).
    // Merge + dedup so a match listed by both appears once. Each source is
    // allowed to fail independently so transient rate limits do not take the
    // entire static site offline.
    const token = process.env.PANDASCORE_TOKEN;
    const matches = await fetchCs2MatchesForTeams(cs2Teams, token);
    for (const m of matches) {
      events.push({
        uid: cs2Uid(m),
        kind: 'cs2',
        title: m.title,
        subtitle: m.tournament,
        team1: m.team1,
        team2: m.team2,
        tournament: m.tournament,
        start: m.start,
        end: m.start + CS2_DURATION_MIN * 60 * 1000,
        inCalendar: true,
        trackerId: null, // may match multiple teams; resolved in frontend
        trackerLabel: cs2Teams.join(' / '),
        source: m.source || 'lp', // 'lp' (Liquipedia) or 'ps' (PandaScore)
      });
    }
  }

  events.sort((a, b) => a.start - b.start);
  return events;
}

/**
 * Build calendar-worthy events for the .ics feed (qualifying + race for F1,
 * all tracked CS2 matches). Completed events remain in the subscription so
 * calendar clients do not delete them during a refresh.
 */
async function buildCalendarEvents() {
  const all = await buildEvents();
  return calendarEventsFrom(all);
}

function calendarEventsFrom(all) {
  return all
    .filter((e) => e.inCalendar)
    .map((e) => ({
      uid: e.uid,
      summary: e.kind === 'f1'
        ? `F1 ${e.title} · ${e.subtitle}`
        : `CS2 ${e.title} · ${e.subtitle}`,
      description: e.kind === 'f1'
        ? `${e.title} (${e.session}) — ${e.circuit}, ${e.country}`
        : `${e.team1} vs ${e.team2} — ${e.tournament}`,
      start: e.start,
      end: e.end,
      location: e.kind === 'f1' ? e.circuit : undefined,
      reminderMin: 60,
    }));
}

/**
 * All data a static consumer needs, in one call.
 * @returns {Promise<{events:Array, calendarEvents:Array, trackers:Array, f1Year:number}>}
 */
async function buildStaticData(previousEvents = []) {
  const trackers = store.getTrackers();
  const currentEvents = await buildEvents();
  const events = preserveHistoricalEvents(currentEvents, previousEvents);
  // Reuse the events we just fetched. Calling buildCalendarEvents() here would
  // fetch every upstream schedule a second time during the same build.
  const calendarEvents = calendarEventsFrom(events);
  return {
    events,
    calendarEvents,
    trackers,
    f1Year: store.getF1Year(),
  };
}

module.exports = {
  F1_CALENDAR_SESSIONS,
  F1_DURATIONS,
  CS2_DURATION_MIN,
  f1Uid,
  cs2Uid,
  buildEvents,
  buildCalendarEvents,
  buildStaticData,
  mergeCs2Matches,
  fetchCs2MatchesForTeams,
  preserveHistoricalEvents,
  calendarEventsFrom,
};
