'use strict';

// Static build: fetch schedules and write deployable files to dist/.
// Run by GitHub Actions (or locally) to produce the GitHub Pages site:
//
//   dist/
//     index.html     copied from public/
//     calendar.ics   iCal feed for the Apple Calendar subscription
//     events.json    data consumed by the frontend
//     .nojekyll      empty marker (skip Jekyll processing)

const fs = require('node:fs');
const path = require('node:path');

const eventsLib = require('../lib/events');
const ics = require('../lib/ics');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const PUBLIC_INDEX = path.join(__dirname, '..', 'public', 'index.html');

async function loadPreviousEvents(url) {
  if (!url) return [];

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'sports-watchlist/1.0',
    },
  });
  if (!res.ok) throw new Error(`Previous events API ${res.status}: ${url}`);

  const payload = await res.json();
  if (!Array.isArray(payload?.events)) {
    throw new Error(`Previous events payload is invalid: ${url}`);
  }
  return payload.events;
}

async function main() {
  fs.mkdirSync(DIST_DIR, { recursive: true });

  const previousEvents = await loadPreviousEvents(process.env.PREVIOUS_EVENTS_URL);
  if (previousEvents.length > 0) {
    console.log(`Previous events    ${previousEvents.length} loaded`);
  }

  console.log('Fetching schedules...');
  const data = await eventsLib.buildStaticData(previousEvents);

  // calendar.ics
  const cal = ics.buildCalendar(data.calendarEvents, 'Sports Watchlist');
  fs.writeFileSync(path.join(DIST_DIR, 'calendar.ics'), cal, 'utf8');
  console.log(`calendar.ics      ${data.calendarEvents.length} events`);

  // events.json
  const payload = {
    generatedAt: new Date().toISOString(),
    f1Year: data.f1Year,
    trackers: data.trackers,
    events: data.events,
  };
  fs.writeFileSync(
    path.join(DIST_DIR, 'events.json'),
    JSON.stringify(payload),
    'utf8'
  );
  console.log(`events.json       ${data.events.length} events (${data.trackers.length} trackers)`);

  // index.html
  fs.copyFileSync(PUBLIC_INDEX, path.join(DIST_DIR, 'index.html'));
  console.log('index.html       copied');

  // .nojekyll
  fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '');
  console.log('.nojekyll        written');

  console.log('Done. Output in dist/');
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
