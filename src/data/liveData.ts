// ── LIVE RESULTS FEED (football-data.org) ────────────────────────────────────
// Turns the real World Cup group-stage fixtures from football-data.org into the
// `Results` shape the projection engine consumes. The browser calls a relative
// `/api/football-data/...` path; the Vite dev proxy (see vite.config.ts) forwards
// it to the real API and injects the `X-Auth-Token` header server-side — so the
// API key is never shipped to the client and CORS is sidestepped.
//
// Design note: our team list / draw is a placeholder (the real WC2026 R32 draw
// isn't locked until the group stage ends), so the feed only overrides fixtures
// whose teams we can map. Everything else keeps its seeded value, and the engine
// re-projects from the merged table. `syncedMatches` / `unmatched` report how
// much actually mapped, so it's honest about coverage.
// ─────────────────────────────────────────────────────────────────────────────

import { DEFAULT_RESULTS, FIX, GROUPS, TEAMS, type Results, type Score } from './wc-data';

export interface LiveSyncResult {
  results: Results;
  source: 'live' | 'mock';
  syncedMatches: number;
  unmatched: string[];
  fetchedAt: Date;
  error?: string;
}

export const LIVE_REFRESH_MS = 60_000;
const PROXY_BASE = '/api/football-data';
const WC_COMPETITION = 'WC';

// Aliases for the names football-data.org uses that don't exactly match TEAMS[].n.
const NAME_ALIASES: Record<string, string> = {
  'korea republic': 'KOR', 'south korea': 'KOR', 'czech republic': 'CZE',
  'bosnia and herzegovina': 'BIH', 'bosnia & herzegovina': 'BIH',
  usa: 'USA', 'united states': 'USA', turkey: 'TUR', turkiye: 'TUR',
  "cote d'ivoire": 'CIV', 'ivory coast': 'CIV', 'cabo verde': 'CPV', 'cape verde': 'CPV',
  'ir iran': 'IRN', iran: 'IRN', 'congo dr': 'COD', 'dr congo': 'COD',
  'democratic republic of congo': 'COD', curacao: 'CUW',
};

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').trim();

// name -> team code, built once from TEAMS plus the alias table.
const NAME_INDEX: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  Object.entries(TEAMS).forEach(([code, t]) => { idx[normalize(t.n)] = code; });
  Object.entries(NAME_ALIASES).forEach(([name, code]) => { idx[normalize(name)] = code; });
  return idx;
})();

function teamCode(name: string | undefined | null): string | null {
  if (!name) return null;
  return NAME_INDEX[normalize(name)] ?? null;
}

function cloneResults(src: Results): Results {
  const out: Results = {};
  Object.keys(src).forEach((g) => (out[g] = src[g].map((x) => (x ? { ...x } : null))));
  return out;
}

interface FDMatch {
  group?: string | null;
  status?: string;
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  score?: { fullTime?: { home: number | null; away: number | null }; halfTime?: { home: number | null; away: number | null } };
}

// Pull the best-available score (running score for in-play, full-time for finished).
function scoreOf(m: FDMatch): { h: number; a: number } | null {
  const ft = m.score?.fullTime;
  if (ft && ft.home != null && ft.away != null) return { h: ft.home, a: ft.away };
  const ht = m.score?.halfTime;
  if (ht && ht.home != null && ht.away != null) return { h: ht.home, a: ht.away };
  return null;
}

// Find which of our groups contains both team codes (fallback when `group` is absent).
function groupOf(homeCode: string, awayCode: string, hinted: string | null): string | null {
  if (hinted && GROUPS[hinted]) return hinted;
  for (const g of Object.keys(GROUPS)) {
    const ids = GROUPS[g];
    if (ids.includes(homeCode) && ids.includes(awayCode)) return g;
  }
  return null;
}

// Place a real match into the seeded table at the correct fixture index + orientation.
function applyMatch(results: Results, m: FDMatch, unmatched: Set<string>): boolean {
  const homeCode = teamCode(m.homeTeam?.name);
  const awayCode = teamCode(m.awayTeam?.name);
  if (!homeCode) { if (m.homeTeam?.name) unmatched.add(m.homeTeam.name); }
  if (!awayCode) { if (m.awayTeam?.name) unmatched.add(m.awayTeam.name); }
  if (!homeCode || !awayCode) return false;

  const score = scoreOf(m);
  if (!score) return false;

  const hintedGroup = m.group ? m.group.replace(/^group[_\s-]*/i, '').toUpperCase() : null;
  const g = groupOf(homeCode, awayCode, hintedGroup);
  if (!g) return false;

  const ids = GROUPS[g];
  const hi = ids.indexOf(homeCode), ai = ids.indexOf(awayCode);
  const fi = FIX.findIndex(([x, y]) => (x === hi && y === ai) || (x === ai && y === hi));
  if (fi < 0) return false;

  // results[g][fi] = {h,a} where h is goals for ids[FIX[fi][0]].
  const cell: Score =
    FIX[fi][0] === hi ? { h: score.h, a: score.a } : { h: score.a, a: score.h };
  results[g][fi] = cell;
  return true;
}

/**
 * Fetch the real WC group-stage results and merge them onto the seeded table.
 * On any failure (no key / proxy / network) it resolves to the seeded data with
 * `source:'mock'` and an `error` string, so the UI degrades gracefully.
 */
export async function fetchLiveResults(signal?: AbortSignal): Promise<LiveSyncResult> {
  const results = cloneResults(DEFAULT_RESULTS);
  const base: LiveSyncResult = {
    results, source: 'mock', syncedMatches: 0, unmatched: [], fetchedAt: new Date(),
  };

  try {
    const res = await fetch(`${PROXY_BASE}/competitions/${WC_COMPETITION}/matches?stage=GROUP_STAGE`, {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!res.ok) {
      return { ...base, error: `Feed responded ${res.status} ${res.statusText}` };
    }
    const data = (await res.json()) as { matches?: FDMatch[] };
    const matches = data.matches ?? [];

    const unmatched = new Set<string>();
    let synced = 0;
    for (const m of matches) {
      if (applyMatch(results, m, unmatched)) synced++;
    }

    return {
      results,
      source: synced > 0 ? 'live' : 'mock',
      syncedMatches: synced,
      unmatched: [...unmatched].sort(),
      fetchedAt: new Date(),
      error: synced === 0 ? 'Feed reachable but no fixtures matched the current draw' : undefined,
    };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    return { ...base, error: (err as Error)?.message || 'Live feed unreachable' };
  }
}
