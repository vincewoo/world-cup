# FIFA World Cup 2026 — Bracket Predictor

A dark, vibrant knockout-bracket predictor for the 2026 World Cup, built in
**React + Vite + TypeScript**. Implemented from a Claude Design handoff (the
original prototype and chat transcript live in `chats/` and `project/`).

## What it does

- **Monte-Carlo projection engine** (`src/data/wc-data.ts`) — 3,000 simulations
  of the remaining group games produce each team's advance odds and each R32
  slot's candidate probabilities. Clinched teams (✓) auto-fill.
- **Official WC2026 structure** — all 12 groups, FIFA's Round-of-32 slot rules
  (e.g. Match 74 = *Winner E vs best 3rd from A/B/C/D/F*), the R16→Final feed
  map, and the third-place match.
- **Click-to-advance bracket** — tap any contender to send them through;
  downstream rounds update and now-invalid downstream picks are cleared.
- **Three layouts** — Classic (two-sided, converging on the champion), Flow
  (left-to-right columns), Focus (round-by-round, mobile-friendly).
- **Group odds tab** — live standings with per-team advance %, plus editable
  score steppers; editing any result re-projects everything instantly.
- **Live results feed** — see below.

## Live results (football-data.org)

The seeded scores in `DEFAULT_RESULTS` are the offline fallback. To pull real
group-stage results:

1. Get a free API key at <https://www.football-data.org/client/register>.
2. Copy `.env.example` → `.env` and set `FOOTBALL_DATA_TOKEN=...`.
3. `npm run dev` and click **Refresh live** (or toggle **Auto-refresh**).

How it works: the browser calls a same-origin `/api/football-data/...` path; the
Vite dev proxy (`vite.config.ts`) forwards it to the real API and injects the
`X-Auth-Token` header **server-side**, so the key is never shipped to the client
and CORS is sidestepped. The adapter (`src/data/liveData.ts`) maps each WC
group-stage fixture into our `Results` schema (by team name + group + fixture
orientation) and merges matched results onto the seeded table; unmatched
fixtures keep their seeded value. The status pill reports how many matches
synced. On any failure (no key, network, no matches) it falls back to seeded
data — the UI never breaks.

> Note: our team list / draw is a placeholder until the real R32 draw locks
> (group stage ends June 27). The feed overrides any fixture whose teams it can
> map; coverage is reported honestly in the status pill (`syncedMatches` /
> `unmatched`).

### Production deployment

The dev proxy only runs under `vite dev`. For a production build you need an
equivalent server-side proxy (any platform: a serverless function, an Nginx
`proxy_pass`, etc.) that forwards `/api/football-data/*` to
`https://api.football-data.org/v4/*` and adds the `X-Auth-Token` header. Keep
the key on the server.

## Commands

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Project layout

```
src/
  data/
    wc-data.ts     # teams, groups, official slots/feed/venues + Monte-Carlo engine
    liveData.ts    # football-data.org adapter → Results schema (live feed)
  components/
    Matchup.tsx    # reusable candidate-list match card
    Bracket.tsx    # Classic / Flow / Focus layouts + champion card
    GroupOdds.tsx  # standings + advance % + editable score steppers
    Hover.tsx      # inline-style :hover helper
  rounds.ts        # column/round definitions per layout
  viewmodel.ts     # picks + projection → MatchView builders
  types.ts         # shared view-model types
  App.tsx          # shell: header, controls, live-data control, view switching
```
