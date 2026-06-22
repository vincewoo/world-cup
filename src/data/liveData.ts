// ── LIVE RESULTS FEED (football-data.org) ────────────────────────────────────
// Turns the real World Cup fixtures from football-data.org into the shapes our
// projection + bracket consume. The browser calls a relative `/api/football-data/...`
// path; the Vite dev proxy (see vite.config.ts) forwards it to the real API and
// injects the `X-Auth-Token` header server-side — so the API key is never shipped
// to the client and CORS is sidestepped.
//
// Two layers of real data:
//   1. GROUP STAGE → merged onto the seeded `Results` table; the engine re-projects
//      R32 slot odds from it. `syncedMatches` / `unmatched` report coverage.
//   2. KNOCKOUT → once the group stage decides who fills each R32 slot, we derive
//      the *actual* bracket (winners/runners-up + FIFA best-third allocation), then
//      walk it R32→Final. For any match the API has already played we lock in the
//      real winner and auto-advance it. `lockedSlots` carries the confirmed R32
//      matchups; `lockedPicks` carries the confirmed results (match → winner code).
//
// Design note: our team list / draw is a placeholder until the real WC2026 R32
// draw locks (group stage ends June 27), so the feed only fills slots / locks
// results whose teams we can map. Everything else keeps its projected value.
// ─────────────────────────────────────────────────────────────────────────────

import {
  DEFAULT_RESULTS, FIX, GKEYS, GROUPS, SLOTS, FEED,
  assignThirds, compareThirds, currentStandings,
  type Results, type Score, type SlotSideDef,
} from './wc-data';
import { pairKey, teamCode } from './teamNames';

export interface LiveSyncResult {
  results: Results;
  source: 'live' | 'mock';
  syncedMatches: number;
  unmatched: string[];
  fetchedAt: Date;
  error?: string;
  /** Confirmed R32 matchups: slot side key (`<match><A|B>`) → team code. */
  lockedSlots: Record<string, string>;
  /** Confirmed knockout results: match number → winning team code (auto-advance). */
  lockedPicks: Record<number, string>;
  /** Count of knockout matches whose actual result was locked in. */
  lockedResults: number;
}

export const LIVE_REFRESH_MS = 60_000;
const PROXY_BASE = '/api/football-data';
const WC_COMPETITION = 'WC';

// Knockout match numbers in dependency order (R32 → R16 → QF → SF → 3rd → Final).
// Walked in this order so every match's feeders are already resolved when we reach it.
const KO_ORDER = [
  73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88,
  89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104,
];

function cloneResults(src: Results): Results {
  const out: Results = {};
  Object.keys(src).forEach((g) => (out[g] = src[g].map((x) => (x ? { ...x } : null))));
  return out;
}

interface FDScore {
  home: number | null;
  away: number | null;
}
interface FDMatch {
  stage?: string;
  group?: string | null;
  status?: string;
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  score?: {
    winner?: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
    fullTime?: FDScore;
    halfTime?: FDScore;
    penalties?: FDScore;
  };
}

const isGroupStage = (m: FDMatch) => m.stage === 'GROUP_STAGE' || (m.stage == null && m.group != null);

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

// Which side won a finished knockout match (after ET / penalties), or null if
// undecided. Prefers the API's explicit `winner`, falling back to fullTime+pens.
function winnerCode(m: FDMatch, homeCode: string, awayCode: string): string | null {
  const w = m.score?.winner;
  if (w === 'HOME_TEAM') return homeCode;
  if (w === 'AWAY_TEAM') return awayCode;
  if (w === 'DRAW') return null;
  const ft = m.score?.fullTime, pe = m.score?.penalties;
  if (ft && ft.home != null && ft.away != null) {
    const h = ft.home + (pe?.home ?? 0), a = ft.away + (pe?.away ?? 0);
    if (h > a) return homeCode;
    if (a > h) return awayCode;
  }
  return null;
}

const groupComplete = (results: Results, g: string) => FIX.every((_, i) => results[g]?.[i] != null);

/**
 * Derive the actual knockout bracket from (real) group results, then lock in the
 * result of every knockout match the API has already played.
 *
 *  - `lockedSlots[<match><A|B>]`  the confirmed team in each R32 slot side. Group
 *    winners/runners-up lock as soon as their group finishes; best-third slots
 *    once all 12 groups finish (the FIFA allocation needs the full third-place rank).
 *  - `lockedPicks[match]`         the actual winner of any knockout match whose two
 *    participants are known *and* which the API reports as decided — walked
 *    R32→Final so each round feeds the next.
 */
function deriveBracket(results: Results, koByPair: Map<string, string>) {
  const lockedSlots: Record<string, string> = {};
  const lockedPicks: Record<number, string> = {};

  const standings = currentStandings(results);
  const rows = Object.fromEntries(standings.map((s) => [s.g, s.rows]));
  const complete = Object.fromEntries(GKEYS.map((g) => [g, groupComplete(results, g)]));
  const allComplete = GKEYS.every((g) => complete[g]);

  const winnerOf = (g: string) => (complete[g] ? rows[g][0].id : null);
  const runnerOf = (g: string) => (complete[g] ? rows[g][1].id : null);

  // Best-third allocation (FIFA): rank the 12 third-placed teams, top 8 advance,
  // then place them into the third-place slots by allowed-group rules.
  let thirdByGroup: Record<string, string> = {};
  let thirdSlotGroup: Record<number, string> = {};
  if (allComplete) {
    const thirds = GKEYS.map((g) => ({ g, ...rows[g][2] }))
      .sort(compareThirds);
    const adv = thirds.slice(0, 8);
    adv.forEach((x) => (thirdByGroup[x.g] = x.id));
    thirdSlotGroup = assignThirds(adv.map((x) => x.g)); // match number → group
  }

  const sideTeam = (m: number, side: SlotSideDef): string | null => {
    if (side.t === 'W') return winnerOf(side.g);
    if (side.t === 'R') return runnerOf(side.g);
    const g = thirdSlotGroup[m]; // best-third
    return g ? thirdByGroup[g] ?? null : null;
  };

  // Lock the R32 slot teams (matches 73–88).
  for (const s of SLOTS) {
    const a = sideTeam(s.m, s.a), b = sideTeam(s.m, s.b);
    if (a) lockedSlots[s.m + 'A'] = a;
    if (b) lockedSlots[s.m + 'B'] = b;
  }

  // Walk the bracket; lock the actual winner wherever both teams are known and
  // the API has a result for that exact pairing.
  const winner: Record<number, string> = {}, loser: Record<number, string> = {};
  const pairOf = (m: number): [string | null, string | null] => {
    if (m <= 88) return [lockedSlots[m + 'A'] ?? null, lockedSlots[m + 'B'] ?? null];
    const [s1, s2] = FEED[m];
    if (m === 103) return [loser[s1] ?? null, loser[s2] ?? null]; // third-place: the two losers
    return [winner[s1] ?? null, winner[s2] ?? null];
  };
  for (const m of KO_ORDER) {
    const [a, b] = pairOf(m);
    if (!a || !b) continue;
    const win = koByPair.get(pairKey(a, b));
    if (win === a || win === b) {
      winner[m] = win!;
      loser[m] = win === a ? b : a;
      lockedPicks[m] = win!;
    }
  }

  return { lockedSlots, lockedPicks };
}

/**
 * Fetch the real WC results and turn them into (a) a merged group-stage `Results`
 * table the projector re-runs on, and (b) the confirmed knockout bracket (locked
 * R32 matchups + auto-advanced results). On any failure (no key / proxy / network)
 * it resolves to the seeded data with `source:'mock'` and an `error` string, so
 * the UI degrades gracefully.
 */
export async function fetchLiveResults(signal?: AbortSignal): Promise<LiveSyncResult> {
  const results = cloneResults(DEFAULT_RESULTS);
  const base: LiveSyncResult = {
    results, source: 'mock', syncedMatches: 0, unmatched: [], fetchedAt: new Date(),
    lockedSlots: {}, lockedPicks: {}, lockedResults: 0,
  };

  try {
    const res = await fetch(`${PROXY_BASE}/competitions/${WC_COMPETITION}/matches`, {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!res.ok) {
      return { ...base, error: `Feed responded ${res.status} ${res.statusText}` };
    }
    const data = (await res.json()) as { matches?: FDMatch[] };
    const matches = data.matches ?? [];

    // 1. Group stage → merge onto the seeded table.
    const unmatched = new Set<string>();
    let synced = 0;
    // 2. Knockout → index decided matches by team-code pair → winner code.
    const koByPair = new Map<string, string>();

    for (const m of matches) {
      if (isGroupStage(m)) {
        if (applyMatch(results, m, unmatched)) synced++;
        continue;
      }
      const homeCode = teamCode(m.homeTeam?.name), awayCode = teamCode(m.awayTeam?.name);
      if (!homeCode || !awayCode) continue; // teams not resolved yet (TBD / unmapped)
      const win = winnerCode(m, homeCode, awayCode);
      if (win) koByPair.set(pairKey(homeCode, awayCode), win);
    }

    const { lockedSlots, lockedPicks } = deriveBracket(results, koByPair);
    const lockedResults = Object.keys(lockedPicks).length;

    return {
      results,
      source: synced > 0 || lockedResults > 0 ? 'live' : 'mock',
      syncedMatches: synced,
      unmatched: [...unmatched].sort(),
      fetchedAt: new Date(),
      error: synced === 0 && lockedResults === 0
        ? 'Feed reachable but no fixtures matched the current draw'
        : undefined,
      lockedSlots,
      lockedPicks,
      lockedResults,
    };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    return { ...base, error: (err as Error)?.message || 'Live feed unreachable' };
  }
}
