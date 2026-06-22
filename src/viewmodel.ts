// Pure builders that turn (picks + projection) into the MatchView shapes the
// bracket renders. Ported from the App logic in World Cup Predictor.dc.html.

import {
  FEED, SLOTS, TEAMS, VENUES, sideLabel,
  type Projection, type SlotDef,
} from './data/wc-data';
import type { MatchView, Picks, RawRow, SlotView } from './types';

export interface VMContext {
  picks: Picks;
  proj: Projection;
  pickColor: string;
  pick: (m: number, id: string) => void;
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

function rowOf(m: number, id: string, prob: number | null, clinched: boolean, ctx: VMContext): RawRow {
  const t = TEAMS[id];
  return {
    id, flag: t.f, name: t.n, prob, bar: prob != null && !clinched, clinched,
    picked: ctx.picks[m] === id, onPick: () => ctx.pick(m, id),
  };
}

function slotR32(m: number, side: 'A' | 'B', ctx: VMContext): SlotView {
  const def = (SLOTS.find((s) => s.m === m) as SlotDef)[side === 'A' ? 'a' : 'b'];
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
  const headerRight = m === 104 ? 'Final' : m === 103 ? '3rd place' : 'Match ' + m;
  const highlight = slotA.rows.concat(slotB.rows).some((r) => r.picked);
  return {
    headerLeft: v.c || '', headerDate: v.d || '', headerRight,
    slotA, slotB, highlight, pickColor: ctx.pickColor || '#63e06f',
  };
}
