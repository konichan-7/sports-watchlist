'use strict';

// CS2 upcoming matches fetcher using Liquipedia's MediaWiki API.
// Liquipedia renders a global "Liquipedia:Matches" ticker page listing all
// upcoming CS2 matches. We request the rendered HTML (prop=text) and parse
// the `.match-info` blocks.
//
// Note: Liquipedia REQUIRES gzip encoding on API requests (else HTTP 406).

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const PAGE_URL = 'https://liquipedia.net/counterstrike/api.php' +
  '?action=parse&page=Liquipedia:Matches&format=json&prop=text&formatversion=2';

let cache = null;
let cacheExpires = 0;

async function fetchJsonGzip(url, attempts = 3) {
  let res;
  for (let i = 0; i < attempts; i++) {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        // Liquipedia requires the Accept-Encoding header (else HTTP 406).
        // Node's built-in fetch decompresses gzip transparently, so we can
        // read the response as plain text.
        'Accept-Encoding': 'gzip, deflate',
      },
    });
    // Retry on rate-limit (429) / server (5xx) / transient failures.
    if (res.ok || (res.status !== 429 && res.status < 500)) break;
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  if (!res.ok) throw new Error(`Liquipedia API ${res.status}: ${url}`);
  return JSON.parse(await res.text());
}

/**
 * Fetch all upcoming CS2 matches from the Liquipedia ticker.
 * @returns {Promise<Array>} normalized upcoming matches
 */
async function fetchUpcoming() {
  const now = Date.now();
  if (cache && cacheExpires > now) return cache;

  const data = await fetchJsonGzip(PAGE_URL);
  const html = data?.parse?.text || '';
  const matches = parseMatches(html);

  cache = matches;
  cacheExpires = now + CACHE_TTL_MS;
  return matches;
}

/**
 * Parse upcoming `.match-info` blocks out of the ticker HTML.
 *
 * Each block looks roughly like:
 *   <div class="match-info">
 *     <span class="timer-object" data-timestamp="1785514200">July 31, ...</span>
 *     ... two team blocks, each with:
 *         <span class="name"><a href="/counterstrike/Spirit" title="Spirit">Spirit</a></span>
 *     ... and a tournament:
 *         <span class="match-info-tournament-name"><a ...><span>BLAST Bounty ...</span></a>
 *
 * We split on `class="match-info"` and scan each block for the three fields.
 *
 * @param {string} html
 * @returns {Array<object>}
 */
function parseMatches(html) {
  // The page has two toggle areas: content=1 is "Upcoming", content=2 is
  // "Completed". We only want upcoming matches — the completed section
  // contains past results and must be excluded.
  const upStart = html.indexOf('data-toggle-area-content="1"');
  const upEnd = html.indexOf('data-toggle-area-content="2"');
  const upcomingHtml = upStart !== -1
    ? (upEnd !== -1 ? html.slice(upStart, upEnd) : html.slice(upStart))
    : html;

  const blocks = upcomingHtml.split('class="match-info"');
  const matches = [];

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    const tsMatch = block.match(/data-timestamp="(\d+)"/);
    if (!tsMatch) continue;

    // Team names appear inside `.name` spans; there can be 1-2 per match
    const nameRe = /<span class="name"[^>]*><a[^>]*>([^<]+)<\/a>/g;
    const teams = [];
    let m;
    while ((m = nameRe.exec(block)) !== null) {
      const t = m[1].trim();
      if (t && !teams.includes(t)) teams.push(t);
    }

    // Tournament name inside `.match-info-tournament-name`
    const tournMatch = block.match(
      /match-info-tournament-name[^>]*>\s*<a[^>]*>\s*<span>([^<]+)<\/span>/
    );
    const tournament = tournMatch ? tournMatch[1].trim() : '';

    // Skip if we can't determine what's playing
    if (teams.length < 2) continue;

    matches.push({
      kind: 'cs2',
      start: Number(tsMatch[1]) * 1000, // Unix seconds -> ms
      team1: teams[0],
      team2: teams[1],
      tournament,
      title: `${teams[0]} vs ${teams[1]}`,
      source: 'lp',
    });
  }

  matches.sort((a, b) => a.start - b.start);
  return matches;
}

/**
 * Filter upcoming matches to those involving any tracked team (case-insensitive
 * substring match on team name).
 * @param {Array<string>} trackedTeams
 * @returns {Promise<Array>}
 */
async function getMatchesForTeams(trackedTeams) {
  const all = await fetchUpcoming();
  const lower = trackedTeams.map((t) => t.toLowerCase());
  return all.filter((m) =>
    lower.some((t) => m.team1.toLowerCase().includes(t) || m.team2.toLowerCase().includes(t))
  );
}

module.exports = { getMatchesForTeams, fetchUpcoming, parseMatches };
