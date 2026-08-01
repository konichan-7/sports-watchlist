'use strict';

// Minimal iCalendar (.ics) generator for the subscribed Apple Calendar feed.
// RFC 5545-compliant output with UTC timestamps + VALARM (1h before).

// Escape text per RFC 5545
function esc(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Date to "YYYYMMDDTHHMMSSZ" (UTC)
function toIcalDate(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Build the full calendar document.
 *
 * @param {Array<object>} events - each event:
 *   {
 *     uid: string,          // stable unique id
 *     summary: string,      // event title
 *     description?: string,
 *     start: number,        // epoch ms
 *     end: number,          // epoch ms
 *     location?: string,
 *     reminderMin?: number, // default 60
 *   }
 * @returns {string} .ics content
 */
function buildCalendar(events, calendarName = 'Sports Watchlist') {
  const now = toIcalDate(Date.now());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//sports-watchlist//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calendarName)}`,
    'X-APPLE-CALENDAR-COLOR:#E5564E',
  ];

  for (const ev of events) {
    const reminderMin = ev.reminderMin ?? 60;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${esc(ev.uid)}`,
      `DTSTAMP:${now}`,
      `DTSTART:${toIcalDate(ev.start)}`,
      `DTEND:${toIcalDate(ev.end)}`,
      `SUMMARY:${esc(ev.summary)}`,
    );
    if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `TRIGGER:-PT${reminderMin}M`,
      `DESCRIPTION:${esc(ev.summary)}`,
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

module.exports = { buildCalendar, toIcalDate, esc };
