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
and CORS is sidestepped. The adapter (`src/data/liveData.ts`) pulls *all* WC
fixtures and uses them in two layers:

- **Group stage** — each fixture is mapped into our `Results` schema (by team name
  + group + fixture orientation) and merged onto the seeded table; the engine
  re-projects R32 slot odds from it. Unmatched fixtures keep their seeded value.
- **Knockout (R32 → Final)** — once the group stage decides who fills each R32
  slot, `deriveBracket()` computes the *actual* bracket (group winners/runners-up
  plus FIFA's best-third allocation) and walks it round by round. Any match the
  API has already played is **locked in**: the confirmed R32 matchups replace the
  projected top-3 candidate lists, and the real winner is auto-advanced into the
  next round. Because two teams meet at most once in single-elimination, each
  knockout match is matched purely by its (unordered) team pair.

The status pill reports how many group matches synced and how many knockout
results were locked. On any failure (no key, network, no matches) it falls back to
seeded data — the UI never breaks.

> Note: our team list / draw is a placeholder until the real R32 draw locks
> (group stage ends June 27). The feed only fills slots / locks results whose
> teams it can map; everything else keeps its projected value, and coverage is
> reported honestly in the status pill (`syncedMatches` / `lockedResults`).

### Production deployment

The dev proxy only runs under `vite dev`. For production this repo ships a
ready-made, zero-dependency Node server (`server/proxy.mjs`, Node 18+) that both
serves the built SPA and forwards `/api/football-data/*` to the real API with the
`X-Auth-Token` header injected server-side — so the key stays on the server:

```bash
npm run build                                   # type-check + build to dist/
FOOTBALL_DATA_TOKEN=<your-key> npm run proxy     # serves dist/ + live proxy on :8080
```

Set `PORT` to change the port. Without a token it still serves the app; the live
feed simply falls back to seeded data. If you'd rather deploy the static `dist/`
behind your own infrastructure, replicate the same rule: forward
`/api/football-data/*` → `https://api.football-data.org/v4/*` with the
`X-Auth-Token` header (a serverless function, an Nginx `proxy_pass`, etc.).

## Market odds (Polymarket)

Alongside the model, the app pulls **live, money-backed implied probabilities**
from Polymarket's public [Gamma API](https://gamma-api.polymarket.com) and shows
them next to the Monte-Carlo estimate — *"where does the market disagree with the
model?"*. The adapter (`src/data/polymarketData.ts`) reshapes the events into
three maps:

- **Moneyline** per fixture (3-way *Team A / Draw / Team B*) — keyed by the same
  unordered team-pair key as the live feed. Surfaced on each group fixture row
  and, once both teams lock, under each knockout match card with the model edge.
- **To advance** per team — shown beside the model's advance % in the Group odds
  tab, tinted by how far the market diverges (▲ market higher, ▼ lower). Sourced
  from one dedicated event, [*World Cup: Team to Advance to Knockout
  Stages*](https://polymarket.com/event/world-cup-team-to-advance-to-knockout-stages),
  fetched by its exact slug so the values are authoritative rather than inferred
  from the broad tag query.
- **To win the tournament** per team — shown as title odds for your picked champion.

Per-match markets exist only for **scheduled** fixtures (group games now; knockout
matches once the bracket fills), but the per-team *advance* and *winner* markets
cover every team regardless of which matchups are decided. Anything without a
market simply renders nothing — same graceful-degradation as the results feed.

How it works: like football-data, the browser calls a same-origin
`/api/polymarket/...` path that the dev proxy (`vite.config.ts`) / prod proxy
(`server/proxy.mjs`) forward to the Gamma API. The Gamma API is **public — no key
required**; the proxy only sidesteps CORS. The status pill reports how many
markets matched, or *"Market odds unavailable"* on failure.

> **Network egress:** `gamma-api.polymarket.com` must be reachable from wherever
> the proxy runs (dev machine, prod host, or sandbox allowlist). If it's blocked,
> the feed degrades to "unavailable" and the rest of the app is unaffected. The
> broad World Cup event-list query in `polymarketData.ts` filters by the numeric
> WC2026 `tag_id` (102232) and pages through every event — Polymarket's per-game
> moneyline markets are individual events slugged `fifwc-<home>-<away>-<date>`
> (e.g. `fifwc-nor-sen-2026-06-22`); the advance map uses an exact event slug.

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
