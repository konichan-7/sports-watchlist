'use strict';

// Sports Watchlist — local server (optional; primary deployment is GitHub Pages).
//   * GET  /                 -> frontend page
//   * GET  /api/events       -> upcoming events (all sessions, incl. practice)
//   * GET  /api/trackers     -> list tracked teams
//   * POST /api/trackers     -> add a tracker  {type:'f1'|'cs2', team?, label?}
//   * DELETE /api/trackers/:id
//   * GET  /calendar.ics     -> iCal subscription feed (calendar-worthy events)

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const eventsLib = require('./lib/events');
const ics = require('./lib/ics');
const store = require('./lib/store');

const PORT = process.env.PORT || 8787;
const PUBLIC_DIR = path.join(__dirname, 'public');

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
      const events = await eventsLib.buildEvents();
      return sendJson(res, 200, { events });
    }

    // iCal subscription feed
    if (req.method === 'GET' && pathname === '/calendar.ics') {
      const events = await eventsLib.buildCalendarEvents();
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
