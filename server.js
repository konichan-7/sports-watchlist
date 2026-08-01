'use strict';

// Sports Watchlist — local server.
//   * GET  /                 -> frontend page
//   * GET  /api/events       -> upcoming events (all sessions, incl. practice)
//   * GET  /api/trackers     -> list tracked teams
//   * POST /api/trackers     -> add a tracker  {type:'f1'|'cs2', team?, label?}
//   * DELETE /api/trackers/:id
//   * GET  /calendar.ics     -> iCal subscription feed (calendar-worthy events)

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const f1 = require('./lib/f1');
const cs2 = require('./lib/cs2');
const ics = require('./lib/ics');
const store = require('./lib/store');

const PORT = process.env.PORT || 8787;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------------------------------------------------------------------------
// Event assembly
// ---------------------------------------------------------------------------

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
        title: `${s.raceName}`,
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
    const matches = await cs2.getMatchesForTeams(cs2Teams);
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
      });
    }
  }

  events.sort((a, b) => a.start - b.start);
  return events;
}

/**
 * Build calendar-worthy events for the .ics feed (qualifying + race for F1,
 * all tracked CS2 matches). Only future events.
 */
async function buildCalendarEvents() {
  const all = await buildEvents();
  const now = Date.now();
  return all
    .filter((e) => e.inCalendar && e.end > now)
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

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.length,
    });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  try {
    // Frontend
    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      return serveFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8');
    }

    // Events JSON
    if (req.method === 'GET' && pathname === '/api/events') {
      const events = await buildEvents();
      return sendJson(res, 200, { events });
    }

    // iCal subscription feed
    if (req.method === 'GET' && pathname === '/calendar.ics') {
      const events = await buildCalendarEvents();
      const cal = ics.buildCalendar(events, 'Sports Watchlist');
      res.writeHead(200, {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="calendar.ics"',
        'Cache-Control': 'no-cache',
      });
      return res.end(cal);
    }

    // Trackers CRUD
    if (req.method === 'GET' && pathname === '/api/trackers') {
      return sendJson(res, 200, { trackers: store.getTrackers() });
    }

    if (req.method === 'POST' && pathname === '/api/trackers') {
      const body = await readBody(req);
      const type = body.type;
      if (type !== 'f1' && type !== 'cs2') {
        return sendJson(res, 400, { error: 'type must be "f1" or "cs2"' });
      }
      if (type === 'cs2' && !body.team) {
        return sendJson(res, 400, { error: 'team is required for cs2' });
      }
      const tracker = store.addTracker({
        type,
        team: body.team || undefined,
        label: body.label || (type === 'f1' ? 'F1 全赛站' : `CS2 · ${body.team}`),
      });
      return sendJson(res, 201, { tracker });
    }

    const delMatch = pathname.match(/^\/api\/trackers\/([^/]+)$/);
    if (req.method === 'DELETE' && delMatch) {
      const removed = store.removeTracker(decodeURIComponent(delMatch[1]));
      return sendJson(res, removed ? 200 : 404, { removed });
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (err) {
    console.error('[sports-watchlist]', err);
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`🏁 Sports Watchlist running`);
  console.log(`   Frontend : http://localhost:${PORT}`);
  console.log(`   Calendar : http://localhost:${PORT}/calendar.ics`);
  console.log(`   (Apple 日历 → 文件 → 新建日历订阅 → 粘贴 Calendar 地址)`);
});
