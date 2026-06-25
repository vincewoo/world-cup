// Pure builders that turn (picks + projection) into the MatchView shapes the
// bracket renders. Ported from the App logic in World Cup Predictor.dc.html.

import {
  FEED, SLOTS, TEAMS, VENUES, sideLabel, simGoals,
  type Projection, type SlotDef,
} from './data/wc-data';
import { pairKey } from './data/teamNames';
import type { PolymarketSync } from './data/polymarketData';
import type { MatchView, Picks, RawRow, SlotView } from './types';

export interface VMContext {
  picks: Picks;
  proj: Projection;
  pickColor: string;
  pick: (m: number, id: string) => void;
  /** Confirmed R32 matchups from the live feed: slot-side key → team code. */
  lockedSlots?: Record<string, string>;
  /** Live Polymarket odds (graceful absence when the feed is unavailable). */
  market?: PolymarketSync | null;
}

export function matchTeams(m: number, picks: Picks): [string | null, string | null] {
  const [s1, s2] = FEED[m] || [];
  if (m === 103) return [loserOf(s1, picks), loserOf(s2, picks)];
  return [picks[s1] || null, picks[s2] || null];
}

export function loserOf(m: number, picks: Picks): string | null {
  const [a, b] = matchTeams(m, picks);
  const w = picks[m];
  if (!w) return null;
  return w === a ? b : w === b ? a : null;
}

// Drop downstream picks that no longer have a valid source after an upstream change.
export function cleanup(picks: Picks): void {
  [89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104].forEach((m) => {
    const [s1, s2] = FEED[m];
    const valid = m === 103
      ? [loserOf(s1, picks), loserOf(s2, picks)]
      : [picks[s1] || null, picks[s2] || null];
    if (picks[m] && !valid.includes(picks[m])) delete picks[m];
  });
}

// Simulate a knockout matchup between two teams and return side-A's win %.
// Results are cached by team pair so renders don't re-simulate needlessly.
const KO_SIMS = 500;
const probCache = new Map<string, number>();

export function koWinProb(idA: string, idB: string): number {
  const key = idA + ':' + idB;
  const cached = probCache.get(key);
  if (cached !== undefined) return cached;

  const ra = TEAMS[idA]?.r, rb = TEAMS[idB]?.r;
  if (ra == null || rb == null) return 50;

  let winsA = 0;
  for (let i = 0; i < KO_SIMS; i++) {
    const g = simGoals(ra, rb);
    if (g.h > g.a) winsA++;
    else if (g.h === g.a) {
      // Draw → extra-time approximation: re-sim, ties broken by coin-flip
      const et = simGoals(ra, rb);
      if (et.h > et.a) winsA++;
      else if (et.h === et.a) { if (Math.random() < 0.5) winsA++; }
    }
  }
  const pct = (winsA / KO_SIMS) * 100;
  probCache.set(key, pct);
  probCache.set(idB + ':' + idA, 100 - pct); // cache the inverse too
  return pct;
}

function rowOf(m: number, id: string, prob: number | null, clinched: boolean, ctx: VMContext): RawRow {
  const t = TEAMS[id];
  return {
    id, flag: t.f, name: t.n, prob, bar: prob != null && !clinched, clinched,
    picked: ctx.picks[m] === id, onPick: () => ctx.pick(m, id),
  };
}

function slotR32(m: number, side: 'A' | 'B', ctx: VMContext): SlotView {
  const def = (SLOTS.find((s) => s.m === m) as SlotDef)[side === 'A' ? 'a' : 'b'];
  // Live feed confirmed this matchup → show the real team (locked), not candidates.
  const locked = ctx.lockedSlots?.[m + side];
  if (locked && TEAMS[locked]) {
    return { label: sideLabel(def), rows: [rowOf(m, locked, null, true, ctx)] };
  }
  const ss = ctx.proj.slotSide[m + side];
  let rows: RawRow[] = [];
  if (ss) {
    if (ss.clinched) rows = [rowOf(m, ss.clinched, null, true, ctx)];
    else rows = ss.candidates.slice(0, 3).map((c) => rowOf(m, c.id, c.prob, false, ctx));
  }
  return { label: sideLabel(def), rows };
}

function slotKO(m: number, side: 'A' | 'B', ctx: VMContext): SlotView {
  const src = FEED[m][side === 'A' ? 0 : 1];
  const id = m === 103 ? loserOf(src, ctx.picks) : ctx.picks[src] || null;
  const t = id ? TEAMS[id] : null;
  const rows: RawRow[] = [
    id && t
      ? { id, flag: t.f, name: t.n, prob: null, bar: false, clinched: false, picked: ctx.picks[m] === id, onPick: () => ctx.pick(m, id) }
      : { placeholder: true, name: (m === 103 ? 'Loser ' : 'Winner ') + 'Match ' + src },
  ];
  return { label: '', rows };
}

export function matchView(m: number, ctx: VMContext): MatchView {
  const v = VENUES[m] || ({} as { c?: string; d?: string });
  const slotA = m <= 88 ? slotR32(m, 'A', ctx) : slotKO(m, 'A', ctx);
  const slotB = m <= 88 ? slotR32(m, 'B', ctx) : slotKO(m, 'B', ctx);

  // When both sides resolve to a single team, compute ELO-based win
  // probabilities so the user sees each side's chance in the matchup —
  // instead of a pair of bare "Clinched" labels. This covers knockout
  // pairings (m > 88) and Round-of-32 matches where both slots have clinched.
  let market: MatchView['market'];
  const rowA = slotA.rows[0], rowB = slotB.rows[0];
  const determined = (r: RawRow | undefined): r is RawRow & { id: string } =>
    !!r && !r.placeholder && !!r.id && (!!r.clinched || m > 88);
  if (determined(rowA) && determined(rowB)) {
    const pA = koWinProb(rowA.id, rowB.id);
    // Swap the "Clinched" badge for a head-to-head probability bar on each side.
    rowA.prob = pA; rowA.bar = true; rowA.clinched = false;
    rowB.prob = 100 - pA; rowB.bar = true; rowB.clinched = false;

    // Market vs model: attach the Polymarket moneyline if one exists for this
    // exact pairing (only scheduled/locked matches will have one).
    const mk = ctx.market?.moneyline[pairKey(rowA.id, rowB.id)];
    if (mk) {
      const aIsTeamA = mk.teamA === rowA.id;
      market = {
        pA: aIsTeamA ? mk.pA : mk.pB,
        pB: aIsTeamA ? mk.pB : mk.pA,
        pDraw: mk.pDraw,
        modelA: pA,
        modelB: 100 - pA,
      };
    }
  }

  const headerRight = m === 104 ? 'Final' : m === 103 ? '3rd place' : 'Match ' + m;
  const highlight = slotA.rows.concat(slotB.rows).some((r) => r.picked);
  return {
    headerLeft: v.c || '', headerDate: v.d || '', headerRight,
    slotA, slotB, highlight, pickColor: ctx.pickColor || '#63e06f', market,
  };
}
