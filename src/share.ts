// Pick persistence + sharing. Picks (match no -> team code) are kept in the URL
// (`?p=`) so a bracket is shareable, and mirrored to localStorage so a refresh
// restores them. Encoding is a compact, debuggable string: `match-code` pairs
// joined by `.` (e.g. "104-BRA.101-BRA").
//
// Decoding is defensive: every token is validated against the known matches and
// team codes, so a hand-mangled link can never crash the app. Downstream KO
// picks are additionally pruned for consistency by cleanup() once results load.

import { FEED, SLOTS, TEAMS } from './data/wc-data';
import type { Picks } from './types';

const STORAGE_KEY = 'wc2026:picks';
const PARAM = 'p';

// Every match number a pick may legitimately key on: R32 slots + the KO feed.
const VALID_MATCHES = new Set<number>([
  ...SLOTS.map((s) => s.m),
  ...Object.keys(FEED).map(Number),
]);

export function encodePicks(picks: Picks): string {
  return Object.entries(picks)
    .map(([m, id]) => `${m}-${id}`)
    .join('.');
}

export function decodePicks(str: string | null | undefined): Picks {
  const out: Picks = {};
  if (!str) return out;
  for (const tok of str.split('.')) {
    const [m, id] = tok.split('-');
    const mn = Number(m);
    if (Number.isInteger(mn) && VALID_MATCHES.has(mn) && id && TEAMS[id]) {
      out[mn] = id;
    }
  }
  return out;
}

// URL `?p=` wins (a shared link), otherwise fall back to localStorage.
export function loadPicks(): Picks {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(PARAM);
    if (fromUrl) return decodePicks(fromUrl);
  } catch {
    /* no window / bad URL — ignore */
  }
  try {
    return decodePicks(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

export function savePicks(picks: Picks): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, encodePicks(picks));
  } catch {
    /* private mode / quota — non-fatal */
  }
}

// Current page URL with the picks encoded into `?p=` (or removed when empty).
export function shareUrl(picks: Picks): string {
  const url = new URL(window.location.href);
  const enc = encodePicks(picks);
  if (enc) url.searchParams.set(PARAM, enc);
  else url.searchParams.delete(PARAM);
  return url.toString();
}
