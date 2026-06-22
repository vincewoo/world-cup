// ── POLYMARKET ODDS FEED (gamma-api.polymarket.com) ──────────────────────────
// Pulls live, money-backed implied probabilities from Polymarket's public Gamma
// API and reshapes them into the maps our UI diffs against the Monte-Carlo model.
// The browser calls a relative `/api/polymarket/...` path; the Vite dev proxy
// (vite.config.ts) / prod proxy (server/proxy.mjs) forward it to the real API.
// The Gamma API is public — no key — so the proxy only sidesteps CORS + lets us
// cache; the host must be on the network egress allowlist for fetches to land.
//
// Three market shapes, three maps (all keyed so a missing market = graceful gap):
//   1. MONEYLINE  per fixture (3-way "TeamA / Draw / TeamB") → keyed by pairKey.
//      Exists only for scheduled fixtures (group games now; knockouts once locked).
//   2. ADVANCE    per team ("to reach the knockouts", Yes/No)  → keyed by code.
//   3. CHAMPION   per team ("to win the World Cup", Yes/No or a multi-outcome
//      market) → keyed by code. Advance + champion are per-team, so they cover
//      every team regardless of which matchups are still undecided.
// ─────────────────────────────────────────────────────────────────────────────

import { pairKey, teamCode, normalize } from './teamNames';

/** Implied probability (0–100) for a single per-team market, plus its 24h volume. */
export interface MarketProb {
  pct: number;
  volume: number;
}

/** 3-way match-result implied probabilities (0–100) for a fixture. */
export interface MoneylineOdds {
  teamA: string;
  teamB: string;
  pA: number;
  pDraw: number;
  pB: number;
  volume: number;
}

export interface PolymarketSync {
  source: 'live' | 'mock';
  fetchedAt: Date;
  error?: string;
  /** Count of markets successfully mapped across all three maps. */
  count: number;
  /** Match-result odds, keyed by pairKey(teamA, teamB). */
  moneyline: Record<string, MoneylineOdds>;
  /** "To advance from the group" implied %, keyed by team code. */
  advance: Record<string, MarketProb>;
  /** "To win the tournament" implied %, keyed by team code. */
  champion: Record<string, MarketProb>;
}

const PROXY_BASE = '/api/polymarket';
// World Cup events live under a Polymarket tag/series. The exact tag_slug must be
// confirmed against the live API once egress is allowlisted; until then this is a
// best-effort default and the feed degrades gracefully if it returns nothing.
// This query feeds the moneyline + champion maps (and advance as a fallback).
const EVENTS_QUERY = `${PROXY_BASE}/events?closed=false&limit=500&tag_slug=fifa-world-cup`;

// The "to advance" odds shown in the Group-odds tab come from one dedicated
// Polymarket event (a grouped Yes/No-per-team market), fetched by its exact slug
// so the values are authoritative rather than whatever the broad tag query +
// regex classification happens to surface:
//   https://polymarket.com/event/world-cup-team-to-advance-to-knockout-stages
const ADVANCE_EVENT_SLUG = 'world-cup-team-to-advance-to-knockout-stages';
const ADVANCE_QUERY = `${PROXY_BASE}/events?slug=${ADVANCE_EVENT_SLUG}`;

// ── Raw Gamma API shapes (only the fields we read) ──────────────────────────
interface PMMarket {
  question?: string;
  slug?: string;
  groupItemTitle?: string;
  outcomes?: string; // JSON-encoded string array, e.g. '["Argentina","Draw","Austria"]'
  outcomePrices?: string; // JSON-encoded string array, e.g. '["0.55","0.25","0.20"]'
  volume?: string | number;
  active?: boolean;
  closed?: boolean;
}
interface PMEvent {
  title?: string;
  slug?: string;
  volume?: string | number;
  markets?: PMMarket[];
}

// Gamma encodes array fields as JSON strings; parse leniently.
function parseStrArray(s: string | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

const num = (v: string | number | undefined): number => {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '');
  return Number.isFinite(n) ? n : 0;
};

const isDraw = (name: string) => {
  const n = normalize(name);
  return n === 'draw' || n === 'tie' || n === 'x';
};

const pct = (price: number) => Math.max(0, Math.min(100, price * 100));

// Yes-price of a binary ["Yes","No"] market, or null if not binary.
function yesPrice(outcomes: string[], prices: number[]): number | null {
  if (outcomes.length !== 2) return null;
  const yi = outcomes.findIndex((o) => normalize(o) === 'yes');
  if (yi < 0) return null;
  return prices[yi] ?? null;
}

// Subject team of a per-team (binary / grouped) market.
function subjectTeam(ev: PMEvent, m: PMMarket): string | null {
  return teamCode(m.groupItemTitle) ?? teamCode(m.question) ?? teamCode(ev.title) ?? null;
}

const matches = (s: string | undefined, re: RegExp) => !!s && re.test(s.toLowerCase());
const CHAMP_RE = /winner|champion|win the (world cup|tournament|wc|trophy)|lift the/;
const ADVANCE_RE = /advance|qualif|knockout|round of 32|group stage|progress|reach the/;

/**
 * Classify one market and fold it into the right map. Unrecognized shapes are
 * skipped (returns false) so the feed never throws on an unexpected market.
 */
function ingestMarket(ev: PMEvent, m: PMMarket, out: PolymarketSync): boolean {
  if (m.closed) return false;
  const outcomes = parseStrArray(m.outcomes);
  const prices = parseStrArray(m.outcomePrices).map((p) => parseFloat(p));
  if (outcomes.length < 2 || outcomes.length !== prices.length) return false;
  const vol = num(m.volume) || num(ev.volume);

  // 1. 3-way moneyline: exactly one "Draw" outcome + two team outcomes.
  const drawIdx = outcomes.findIndex(isDraw);
  if (outcomes.length === 3 && drawIdx >= 0) {
    const sides = outcomes
      .map((o, i) => ({ code: teamCode(o), p: prices[i], i }))
      .filter((s) => s.i !== drawIdx);
    const [a, b] = sides;
    if (a?.code && b?.code && a.code !== b.code) {
      out.moneyline[pairKey(a.code, b.code)] = {
        teamA: a.code, teamB: b.code,
        pA: pct(a.p), pB: pct(b.p), pDraw: pct(prices[drawIdx]), volume: vol,
      };
      return true;
    }
    return false;
  }

  const ctx = `${ev.title ?? ''} ${m.question ?? ''}`;

  // 2. Multi-outcome single market of team names (no draw) → champion field.
  if (outcomes.length > 3 && drawIdx < 0 && matches(ctx, CHAMP_RE)) {
    let any = false;
    outcomes.forEach((o, i) => {
      const code = teamCode(o);
      if (code) { out.champion[code] = { pct: pct(prices[i]), volume: vol }; any = true; }
    });
    return any;
  }

  // 3. Binary per-team market (Yes/No): advance or champion by context.
  const yes = yesPrice(outcomes, prices);
  if (yes != null) {
    const code = subjectTeam(ev, m);
    if (!code) return false;
    if (matches(ctx, CHAMP_RE)) { out.champion[code] = { pct: pct(yes), volume: vol }; return true; }
    if (matches(ctx, ADVANCE_RE)) { out.advance[code] = { pct: pct(yes), volume: vol }; return true; }
  }
  return false;
}

/** Fold a list of Gamma events into the three odds maps. Pure — no network. */
export function foldEvents(events: PMEvent[]): PolymarketSync {
  const out: PolymarketSync = {
    source: 'mock', fetchedAt: new Date(), count: 0,
    moneyline: {}, advance: {}, champion: {},
  };
  for (const ev of events) {
    for (const m of ev.markets ?? []) {
      if (ingestMarket(ev, m, out)) out.count++;
    }
  }
  out.source = out.count > 0 ? 'live' : 'mock';
  if (out.count === 0) out.error = 'No World Cup markets matched';
  return out;
}

/**
 * Map the dedicated "team to advance to the knockout stages" event into the
 * advance map, overwriting whatever the broad tag query inferred. Every market
 * in this event is a per-team Yes/No on advancing, so we map them directly —
 * no regex classification — making this the authoritative source for the
 * Group-odds "Market" column. Returns the number of teams mapped. Pure.
 */
export function foldAdvanceEvent(events: PMEvent[], out: PolymarketSync): number {
  let n = 0;
  for (const ev of events) {
    for (const m of ev.markets ?? []) {
      if (m.closed) continue;
      const outcomes = parseStrArray(m.outcomes);
      const prices = parseStrArray(m.outcomePrices).map((p) => parseFloat(p));
      if (outcomes.length !== prices.length) continue;
      const yes = yesPrice(outcomes, prices);
      if (yes == null) continue;
      const code = subjectTeam(ev, m);
      if (!code) continue;
      out.advance[code] = { pct: pct(yes), volume: num(m.volume) || num(ev.volume) };
      n++;
    }
  }
  return n;
}

// Fetch one Gamma `/events` query and normalize its envelope to a PMEvent[].
// Throws on a non-OK response so the caller can fold the error into its status.
async function fetchEvents(query: string, signal?: AbortSignal): Promise<PMEvent[]> {
  const res = await fetch(query, { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) throw new Error(`Polymarket responded ${res.status} ${res.statusText}`);
  const data = (await res.json()) as PMEvent[] | { events?: PMEvent[] };
  return Array.isArray(data) ? data : data.events ?? [];
}

/**
 * Fetch live Polymarket odds and reshape them into moneyline / advance / champion
 * maps. Two requests run in parallel: the broad World Cup tag query (moneyline +
 * champion) and the dedicated "team to advance to the knockout stages" event,
 * which is the authoritative source for the Group-odds advance column and
 * overrides anything the tag query inferred. Each request degrades on its own,
 * and on total failure (egress blocked / proxy / parse) it resolves to empty
 * maps with `source:'mock'` and an `error` string, so the UI never breaks.
 */
export async function fetchPolymarketOdds(signal?: AbortSignal): Promise<PolymarketSync> {
  const [tag, advance] = await Promise.allSettled([
    fetchEvents(EVENTS_QUERY, signal),
    fetchEvents(ADVANCE_QUERY, signal),
  ]);

  // A caller-initiated abort should reject, not surface as a silent failure.
  for (const r of [tag, advance]) {
    if (r.status === 'rejected' && (r.reason as Error)?.name === 'AbortError') throw r.reason;
  }

  const out = tag.status === 'fulfilled'
    ? foldEvents(tag.value)
    : {
        source: 'mock' as const, fetchedAt: new Date(), count: 0,
        moneyline: {}, advance: {}, champion: {},
        error: (tag.reason as Error)?.message || 'Polymarket feed unreachable',
      };

  // The dedicated advance event wins for the advance map regardless of the tag query.
  if (advance.status === 'fulfilled') {
    const mapped = foldAdvanceEvent(advance.value, out);
    if (mapped > 0) {
      out.count += mapped;
      out.source = 'live';
      out.error = undefined;
    }
  }

  return out;
}
