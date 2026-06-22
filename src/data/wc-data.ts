// FIFA World Cup 2026 — real draw, official bracket structure, and a Monte-Carlo
// qualification projection engine. (Faithful TypeScript port of the design
// prototype's wc-data.js — business logic only, no UI.)
//
// ── LIVE DATA HOOK ───────────────────────────────────────────────────────────
// Results are seeded best-effort as of ~June 21, 2026 (mid group stage). Some
// scores are approximate — edit DEFAULT_RESULTS, or pass a fresh `Results`
// object to project() to refresh everything. The live feed (see ./liveData.ts)
// produces exactly this `Results` shape. Fixture order per group is fixed (FIX).
// ─────────────────────────────────────────────────────────────────────────────

export interface Team {
  n: string;
  f: string;
  r: number;
}

/** A single fixture result: goals for the two teams in FIX order, or null if unplayed. */
export type Score = { h: number; a: number } | null;

/** group letter -> 6 fixture results (in FIX order). */
export type Results = Record<string, Score[]>;

export type SlotSideDef =
  | { t: 'W'; g: string }
  | { t: 'R'; g: string }
  | { t: '3'; allow: string[] };

export interface SlotDef {
  m: number;
  a: SlotSideDef;
  b: SlotSideDef;
}

export interface TeamProb {
  p1: number;
  p2: number;
  p3: number;
  adv: number;
}

export interface SlotSide {
  candidates: { id: string; prob: number }[];
  clinched: string | null;
}

export interface Projection {
  runs: number;
  teamProb: Record<string, TeamProb>;
  slotSide: Record<string, SlotSide>;
}

export interface StandingRow {
  id: string;
  pos: number;
  pts: number;
  pld: number;
  gd: number;
  gf: number;
}

export interface GroupStanding {
  g: string;
  rows: StandingRow[];
}

export const TEAMS: Record<string, Team> = {
  MEX: { n: 'Mexico', f: '🇲🇽', r: 1896 }, RSA: { n: 'South Africa', f: '🇿🇦', r: 1527 }, KOR: { n: 'South Korea', f: '🇰🇷', r: 1771 }, CZE: { n: 'Czechia', f: '🇨🇿', r: 1696 },
  CAN: { n: 'Canada', f: '🇨🇦', r: 1777 }, BIH: { n: 'Bosnia & H.', f: '🇧🇦', r: 1596 }, QAT: { n: 'Qatar', f: '🇶🇦', r: 1437 }, SUI: { n: 'Switzerland', f: '🇨🇭', r: 1885 },
  BRA: { n: 'Brazil', f: '🇧🇷', r: 1986 }, MAR: { n: 'Morocco', f: '🇲🇦', r: 1866 }, HAI: { n: 'Haiti', f: '🇭🇹', r: 1528 }, SCO: { n: 'Scotland', f: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', r: 1768 },
  USA: { n: 'United States', f: '🇺🇸', r: 1820 }, PAR: { n: 'Paraguay', f: '🇵🇾', r: 1816 }, AUS: { n: 'Australia', f: '🇦🇺', r: 1799 }, TUR: { n: 'Türkiye', f: '🇹🇷', r: 1813 },
  GER: { n: 'Germany', f: '🇩🇪', r: 1954 }, CUW: { n: 'Curaçao', f: '🇨🇼', r: 1453 }, CIV: { n: 'Ivory Coast', f: '🇨🇮', r: 1728 }, ECU: { n: 'Ecuador', f: '🇪🇨', r: 1864 },
  NED: { n: 'Netherlands', f: '🇳🇱', r: 1972 }, JPN: { n: 'Japan', f: '🇯🇵', r: 1925 }, SWE: { n: 'Sweden', f: '🇸🇪', r: 1727 }, TUN: { n: 'Tunisia', f: '🇹🇳', r: 1570 },
  BEL: { n: 'Belgium', f: '🇧🇪', r: 1869 }, EGY: { n: 'Egypt', f: '🇪🇬', r: 1711 }, IRN: { n: 'Iran', f: '🇮🇷', r: 1766 }, NZL: { n: 'New Zealand', f: '🇳🇿', r: 1578 },
  ESP: { n: 'Spain', f: '🇪🇸', r: 2134 }, CPV: { n: 'Cape Verde', f: '🇨🇻', r: 1625 }, KSA: { n: 'Saudi Arabia', f: '🇸🇦', r: 1593 }, URU: { n: 'Uruguay', f: '🇺🇾', r: 1851 },
  FRA: { n: 'France', f: '🇫🇷', r: 2084 }, SEN: { n: 'Senegal', f: '🇸🇳', r: 1839 }, IRQ: { n: 'Iraq', f: '🇮🇶', r: 1592 }, NOR: { n: 'Norway', f: '🇳🇴', r: 1929 },
  ARG: { n: 'Argentina', f: '🇦🇷', r: 2128 }, ALG: { n: 'Algeria', f: '🇩🇿', r: 1759 }, AUT: { n: 'Austria', f: '🇦🇹', r: 1857 }, JOR: { n: 'Jordan', f: '🇯🇴', r: 1653 },
  POR: { n: 'Portugal', f: '🇵🇹', r: 1967 }, COD: { n: 'DR Congo', f: '🇨🇩', r: 1674 }, UZB: { n: 'Uzbekistan', f: '🇺🇿', r: 1698 }, COL: { n: 'Colombia', f: '🇨🇴', r: 1998 },
  ENG: { n: 'England', f: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', r: 2055 }, CRO: { n: 'Croatia', f: '🇭🇷', r: 1881 }, GHA: { n: 'Ghana', f: '🇬🇭', r: 1557 }, PAN: { n: 'Panama', f: '🇵🇦', r: 1683 },
};

// Group order = seeding (pot) order. Standings are computed from results.
export const GROUPS: Record<string, string[]> = {
  A: ['MEX', 'RSA', 'KOR', 'CZE'], B: ['CAN', 'BIH', 'QAT', 'SUI'], C: ['BRA', 'MAR', 'HAI', 'SCO'],
  D: ['USA', 'PAR', 'AUS', 'TUR'], E: ['GER', 'CUW', 'CIV', 'ECU'], F: ['NED', 'JPN', 'SWE', 'TUN'],
  G: ['BEL', 'EGY', 'IRN', 'NZL'], H: ['ESP', 'CPV', 'KSA', 'URU'], I: ['FRA', 'SEN', 'IRQ', 'NOR'],
  J: ['ARG', 'ALG', 'AUT', 'JOR'], K: ['POR', 'COD', 'UZB', 'COL'], L: ['ENG', 'CRO', 'GHA', 'PAN'],
};
export const GKEYS = Object.keys(GROUPS);

// Fixture order (team indices within a group). MD1: 1v2,3v4 · MD2: 1v3,4v2 · MD3: 4v1,2v3
export const FIX: [number, number][] = [[0, 1], [2, 3], [0, 2], [3, 1], [3, 0], [1, 2]];
export const FIX_MD = [1, 1, 2, 2, 3, 3];

// Seeded results — {h,a} goals in FIX order, or null if not yet played.
export const DEFAULT_RESULTS: Results = {
  A: [{ h: 2, a: 0 }, { h: 2, a: 1 }, { h: 2, a: 1 }, { h: 1, a: 1 }, null, null],
  B: [{ h: 1, a: 1 }, { h: 0, a: 3 }, { h: 2, a: 0 }, { h: 1, a: 1 }, null, null],
  C: [{ h: 2, a: 1 }, { h: 1, a: 2 }, { h: 3, a: 0 }, { h: 1, a: 1 }, null, null],
  D: [{ h: 1, a: 0 }, { h: 1, a: 0 }, { h: 2, a: 0 }, { h: 0, a: 1 }, null, null],
  E: [{ h: 3, a: 1 }, { h: 1, a: 1 }, { h: 2, a: 1 }, { h: 0, a: 0 }, null, null],
  F: [{ h: 1, a: 1 }, { h: 1, a: 0 }, { h: 2, a: 1 }, { h: 1, a: 1 }, null, null],
  G: [{ h: 2, a: 0 }, { h: 1, a: 0 }, null, null, null, null],
  H: [{ h: 3, a: 0 }, { h: 0, a: 1 }, null, null, null, null],
  I: [{ h: 3, a: 1 }, { h: 0, a: 2 }, null, null, null, null],
  J: [{ h: 2, a: 0 }, { h: 2, a: 1 }, null, null, null, null],
  K: [{ h: 2, a: 0 }, { h: 1, a: 2 }, null, null, null, null],
  L: [{ h: 2, a: 0 }, { h: 1, a: 1 }, null, null, null, null],
};

// Official Round of 32 slot definitions (match numbers 73–88).
// side: {t:'W'|'R', g} group winner/runner-up, or {t:'3', allow:[groups]} best-third.
export const SLOTS: SlotDef[] = [
  { m: 73, a: { t: 'R', g: 'A' }, b: { t: 'R', g: 'B' } },
  { m: 74, a: { t: 'W', g: 'E' }, b: { t: '3', allow: ['A', 'B', 'C', 'D', 'F'] } },
  { m: 75, a: { t: 'W', g: 'F' }, b: { t: 'R', g: 'C' } },
  { m: 76, a: { t: 'W', g: 'C' }, b: { t: 'R', g: 'F' } },
  { m: 77, a: { t: 'W', g: 'I' }, b: { t: '3', allow: ['C', 'D', 'F', 'G', 'H'] } },
  { m: 78, a: { t: 'R', g: 'E' }, b: { t: 'R', g: 'I' } },
  { m: 79, a: { t: 'W', g: 'A' }, b: { t: '3', allow: ['C', 'E', 'F', 'H', 'I'] } },
  { m: 80, a: { t: 'W', g: 'L' }, b: { t: '3', allow: ['E', 'H', 'I', 'J', 'K'] } },
  { m: 81, a: { t: 'W', g: 'D' }, b: { t: '3', allow: ['B', 'E', 'F', 'I', 'J'] } },
  { m: 82, a: { t: 'W', g: 'G' }, b: { t: '3', allow: ['A', 'E', 'H', 'I', 'J'] } },
  { m: 83, a: { t: 'R', g: 'K' }, b: { t: 'R', g: 'L' } },
  { m: 84, a: { t: 'W', g: 'H' }, b: { t: 'R', g: 'J' } },
  { m: 85, a: { t: 'W', g: 'B' }, b: { t: '3', allow: ['E', 'F', 'G', 'I', 'J'] } },
  { m: 86, a: { t: 'W', g: 'J' }, b: { t: 'R', g: 'H' } },
  { m: 87, a: { t: 'W', g: 'K' }, b: { t: '3', allow: ['D', 'E', 'I', 'J', 'L'] } },
  { m: 88, a: { t: 'R', g: 'D' }, b: { t: 'R', g: 'G' } },
];

// Feed map for R16→Final (winner of each source match). 103 = third-place (losers).
export const FEED: Record<number, [number, number]> = {
  89: [74, 77], 90: [73, 75], 91: [76, 78], 92: [79, 80], 93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87],
  97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96],
  101: [97, 98], 102: [99, 100], 103: [101, 102], 104: [101, 102],
};

// Venue + date per match (R32 73–80 confirmed; remainder best-effort, editable).
export const VENUES: Record<number, { c: string; d: string }> = {
  73: { c: 'Los Angeles', d: 'Jun 28' }, 74: { c: 'Boston', d: 'Jun 29' }, 75: { c: 'Monterrey', d: 'Jun 29' }, 76: { c: 'Houston', d: 'Jun 29' },
  77: { c: 'New York NJ', d: 'Jun 30' }, 78: { c: 'Dallas', d: 'Jun 30' }, 79: { c: 'Mexico City', d: 'Jun 30' }, 80: { c: 'Atlanta', d: 'Jul 1' },
  81: { c: 'Guadalajara', d: 'Jul 1' }, 82: { c: 'Seattle', d: 'Jul 2' }, 83: { c: 'San Francisco', d: 'Jul 2' }, 84: { c: 'Miami', d: 'Jul 2' },
  85: { c: 'Kansas City', d: 'Jul 3' }, 86: { c: 'Vancouver', d: 'Jul 3' }, 87: { c: 'Toronto', d: 'Jul 3' }, 88: { c: 'Philadelphia', d: 'Jul 3' },
  89: { c: 'Philadelphia', d: 'Jul 4' }, 90: { c: 'Houston', d: 'Jul 4' }, 91: { c: 'New York NJ', d: 'Jul 5' }, 92: { c: 'Mexico City', d: 'Jul 5' },
  93: { c: 'Dallas', d: 'Jul 6' }, 94: { c: 'Seattle', d: 'Jul 6' }, 95: { c: 'Atlanta', d: 'Jul 7' }, 96: { c: 'Vancouver', d: 'Jul 7' },
  97: { c: 'Boston', d: 'Jul 9' }, 98: { c: 'Los Angeles', d: 'Jul 10' }, 99: { c: 'Miami', d: 'Jul 11' }, 100: { c: 'Kansas City', d: 'Jul 11' },
  101: { c: 'Dallas', d: 'Jul 14' }, 102: { c: 'Atlanta', d: 'Jul 15' }, 103: { c: 'Miami', d: 'Jul 18' }, 104: { c: 'New York NJ', d: 'Jul 19' },
};

export function sideLabel(side: SlotSideDef): string {
  if (side.t === 'W') return 'Winner ' + side.g;
  if (side.t === 'R') return 'Runner-up ' + side.g;
  return '3rd ' + side.allow.join('/');
}

// ── Simulation ───────────────────────────────────────────────────────────────
function poisson(l: number): number {
  const L = Math.exp(-l);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}
export function simGoals(ra: number, rb: number): { h: number; a: number } {
  const d = (ra - rb) / 220;
  return { h: poisson(1.36 * Math.exp(d * 0.46)), a: poisson(1.36 * Math.exp(-d * 0.46)) };
}

interface GroupTable {
  ids: string[];
  order: number[];
  pts: number[];
  gf: number[];
  ga: number[];
  pld: number[];
}

// A single result actually used in a group table (real or simulated), in terms of
// the two team indices (0–3) and their goals. Used for head-to-head mini-tables.
interface MiniGame { i: number; j: number; h: number; a: number }

// Rank a group's four teams by the OFFICIAL 2026 FIFA tie-break order:
//   1. points (all matches)
//   2. head-to-head points  ┐ computed in a mini-table among only the teams that
//   3. head-to-head GD       │ are still level on points (the "tied set")
//   4. head-to-head goals    ┘
//   5. overall GD
//   6. overall goals scored
//   7. fair-play / FIFA ranking — not modelled, approximated by team rating in
//      display and by random draw in simulation.
// (2026 moved head-to-head ABOVE overall GD — the first change since 1970.) The
// tied set is the full set of teams equal on points, so the mini-table values are
// fixed per team within a points level, making this comparator a consistent total
// order. We apply the mini-table in a single pass rather than FIFA's strict
// re-cursion onto still-tied subgroups; that only differs in rare 3-way partial
// ties and is immaterial to the projection.
function rankGroup(
  ids: string[], pts: number[], gf: number[], ga: number[], games: MiniGame[], sim: boolean,
): number[] {
  const all = [0, 1, 2, 3];
  const gd = (i: number) => gf[i] - ga[i];

  // Head-to-head mini-table among a subset of team indices.
  const h2h = (subset: number[]) => {
    const hp: Record<number, number> = {}, hgf: Record<number, number> = {}, hga: Record<number, number> = {};
    subset.forEach((i) => { hp[i] = 0; hgf[i] = 0; hga[i] = 0; });
    for (const m of games) {
      if (!subset.includes(m.i) || !subset.includes(m.j)) continue;
      hgf[m.i] += m.h; hga[m.i] += m.a; hgf[m.j] += m.a; hga[m.j] += m.h;
      if (m.h > m.a) hp[m.i] += 3; else if (m.h < m.a) hp[m.j] += 3; else { hp[m.i]++; hp[m.j]++; }
    }
    return { hp, hgd: (i: number) => hgf[i] - hga[i], hgf };
  };

  return all.slice().sort((a, b) => {
    if (pts[b] !== pts[a]) return pts[b] - pts[a];
    const tied = all.filter((x) => pts[x] === pts[a]);
    if (tied.length > 1) {
      const { hp, hgd, hgf } = h2h(tied);
      if (hp[b] !== hp[a]) return hp[b] - hp[a];
      if (hgd(b) !== hgd(a)) return hgd(b) - hgd(a);
      if (hgf[b] !== hgf[a]) return hgf[b] - hgf[a];
    }
    if (gd(b) !== gd(a)) return gd(b) - gd(a);
    if (gf[b] !== gf[a]) return gf[b] - gf[a];
    return sim ? Math.random() - 0.5 : TEAMS[ids[b]].r - TEAMS[ids[a]].r;
  });
}

// Compute one group's table. sim=false → only played games, ties broken by rating
// (deterministic display). sim=true → fill unplayed via ratings.
function table(g: string, results: Results, sim: boolean): GroupTable {
  const ids = GROUPS[g], pts = [0, 0, 0, 0], gf = [0, 0, 0, 0], ga = [0, 0, 0, 0], pld = [0, 0, 0, 0];
  const res = results[g] || [];
  const games: MiniGame[] = [];
  FIX.forEach((pair, fi) => {
    const [i, j] = pair;
    let r = res[fi];
    if (!r) { if (!sim) return; r = simGoals(TEAMS[ids[i]].r, TEAMS[ids[j]].r); }
    pld[i]++; pld[j]++;
    gf[i] += r.h; ga[i] += r.a; gf[j] += r.a; ga[j] += r.h;
    if (r.h > r.a) pts[i] += 3; else if (r.h < r.a) pts[j] += 3; else { pts[i]++; pts[j]++; }
    games.push({ i, j, h: r.h, a: r.a });
  });
  const order = rankGroup(ids, pts, gf, ga, games, sim);
  return { ids, order, pts, gf, ga, pld };
}

// Assign the (up to 8) advancing third-placed teams to the 8 third slots,
// respecting each slot's allowed-group set (backtracking, most-constrained first).
const S3 = SLOTS.filter((s) => s.b.t === '3').map((s) => ({ m: s.m, allow: (s.b as { t: '3'; allow: string[] }).allow }));
export function assignThirds(thirdGroups: string[]): Record<number, string> {
  const slots = S3.map((s) => ({ m: s.m, opts: thirdGroups.filter((g) => s.allow.includes(g)) }))
    .sort((x, y) => x.opts.length - y.opts.length);
  const used: Record<string, number> = {}, out: Record<number, string> = {};
  function bt(k: number): boolean {
    if (k === slots.length) return true;
    for (const g of slots[k].opts) {
      if (used[g]) continue;
      used[g] = 1; out[slots[k].m] = g;
      if (bt(k + 1)) return true;
      used[g] = 0;
    }
    return false;
  }
  bt(0);
  return out; // {matchNo: groupKey}
}

export function currentStandings(results: Results): GroupStanding[] {
  return GKEYS.map((g) => {
    const t = table(g, results, false);
    return {
      g,
      rows: t.order.map((idx, pos) => ({
        id: t.ids[idx], pos: pos + 1, pts: t.pts[idx], pld: t.pld[idx],
        gd: t.gf[idx] - t.ga[idx], gf: t.gf[idx],
      })),
    };
  });
}

export function project(results: Results, runs = 3000): Projection {
  const tp: Record<string, { w: number; r: number; t: number; adv: number }> = {};
  Object.keys(TEAMS).forEach((id) => (tp[id] = { w: 0, r: 0, t: 0, adv: 0 }));
  const side: Record<string, Record<string, number>> = {}; // (m+'A'/'B') -> {team:count}
  const bump = (key: string, id: string) => {
    (side[key] || (side[key] = {}));
    side[key][id] = (side[key][id] || 0) + 1;
  };

  for (let run = 0; run < runs; run++) {
    const W: Record<string, string> = {}, R: Record<string, string> = {};
    const thirds: { g: string; id: string; pts: number; gd: number; gf: number }[] = [];
    for (const g of GKEYS) {
      const t = table(g, results, true);
      const o = t.order;
      W[g] = t.ids[o[0]]; R[g] = t.ids[o[1]];
      tp[W[g]].w++; tp[R[g]].r++;
      thirds.push({ g, id: t.ids[o[2]], pts: t.pts[o[2]], gd: t.gf[o[2]] - t.ga[o[2]], gf: t.gf[o[2]] });
    }
    thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || Math.random() - 0.5);
    const adv = thirds.slice(0, 8);
    adv.forEach((x) => tp[x.id].t++);
    const assign = assignThirds(adv.map((x) => x.g)); // matchNo -> group
    const thirdByGroup: Record<string, string> = {};
    adv.forEach((x) => (thirdByGroup[x.g] = x.id));

    for (const s of SLOTS) {
      // side A
      if (s.a.t === 'W') bump(s.m + 'A', W[s.a.g]); else if (s.a.t === 'R') bump(s.m + 'A', R[s.a.g]);
      // side B
      if (s.b.t === 'W') bump(s.m + 'B', W[s.b.g]);
      else if (s.b.t === 'R') bump(s.m + 'B', R[s.b.g]);
      else { const g = assign[s.m]; if (g) bump(s.m + 'B', thirdByGroup[g]); }
    }
  }

  Object.keys(tp).forEach((id) => { tp[id].adv = tp[id].w + tp[id].r + tp[id].t; });

  // Per-team probabilities (%)
  const teamProb: Record<string, TeamProb> = {};
  Object.keys(TEAMS).forEach((id) => {
    teamProb[id] = {
      p1: (tp[id].w / runs) * 100, p2: (tp[id].r / runs) * 100, p3: (tp[id].t / runs) * 100,
      adv: (tp[id].adv / runs) * 100,
    };
  });

  // Per-slot-side candidate lists + clinch
  const slotSide: Record<string, SlotSide> = {};
  Object.keys(side).forEach((key) => {
    const m = side[key];
    const cands = Object.keys(m).map((id) => ({ id, prob: (m[id] / runs) * 100 })).sort((a, b) => b.prob - a.prob);
    slotSide[key] = { candidates: cands, clinched: cands.length === 1 && cands[0].prob > 99.99 ? cands[0].id : null };
  });

  return { runs, teamProb, slotSide };
}
