// ── SHARED TEAM-NAME MAPPING ─────────────────────────────────────────────────
// Maps the various names external feeds use (football-data.org, Polymarket) onto
// our internal 3-letter team codes, plus a stable key for an unordered matchup.
// Extracted from liveData.ts so every live feed resolves names the same way.
// ─────────────────────────────────────────────────────────────────────────────

import { TEAMS } from './wc-data';

// Aliases for names feeds use that don't exactly match TEAMS[].n. Keys are
// normalized below, so spelling/casing/diacritics here are forgiving.
const NAME_ALIASES: Record<string, string> = {
  // football-data.org
  'korea republic': 'KOR', 'south korea': 'KOR', 'czech republic': 'CZE',
  'bosnia and herzegovina': 'BIH', 'bosnia & herzegovina': 'BIH', 'bosnia-herzegovina': 'BIH',
  usa: 'USA', 'united states': 'USA', turkey: 'TUR', turkiye: 'TUR',
  "cote d'ivoire": 'CIV', 'ivory coast': 'CIV', 'cabo verde': 'CPV', 'cape verde': 'CPV',
  'cape verde islands': 'CPV',
  'ir iran': 'IRN', iran: 'IRN', 'congo dr': 'COD', 'dr congo': 'COD',
  'democratic republic of congo': 'COD', curacao: 'CUW',
  // Polymarket outcome strings (full names; add any that differ from TEAMS[].n)
  'usa men': 'USA', 'south korea republic': 'KOR', algeria: 'ALG',
  'dr congo democratic republic': 'COD',
};

export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').trim();

// name -> team code, built once from TEAMS plus the alias table. We also index
// each team's own 3-letter code, because some feeds identify teams by code
// rather than full name — notably Polymarket's per-game event slugs
// (`fifwc-nor-sen-2026-06-22`) and some of its outcome labels.
const NAME_INDEX: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  Object.entries(TEAMS).forEach(([code, t]) => {
    idx[normalize(t.n)] = code;
    idx[normalize(code)] = code;
  });
  Object.entries(NAME_ALIASES).forEach(([name, code]) => { idx[normalize(name)] = code; });
  return idx;
})();

export function teamCode(name: string | undefined | null): string | null {
  if (!name) return null;
  return NAME_INDEX[normalize(name)] ?? null;
}

// Stable key for an unordered team-code pair. In single-elimination any two
// teams meet at most once, so a pair uniquely identifies a knockout match; the
// same key joins a Polymarket moneyline market onto our fixtures/matchups.
export const pairKey = (a: string, b: string) => [a, b].sort().join('|');
