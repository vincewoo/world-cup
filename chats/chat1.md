# World Cup playoff predictor

_Started 2026-06-21 20:34 UTC_

---

## User

I would like to create a World Cup playoff bracket predictor based on the live results from the games.

## Assistant

A bracket predictor is a great interactive build. Before I start, a few questions so I design the right thing — especially around the "live results" part, since that affects how the whole thing works.

_[tool: questions_v2]_

## User

Questions answered:
- which_cup: FIFA World Cup 2026 (men's, 48 teams)
- live_data: I'll wire in a real data feed later — just leave clean hooks
- core_interaction: Predict winners by clicking through each matchup, Other, Include percentage chance based on the tie-breaking criteria
- platform: Both / responsive
- vibe: Dark mode / modern app
- color: Tournament brand colors (vibrant multi-color)
- detail_level: Just team names + flags + scores
- variations: Yes — show me 2-3 bracket layouts
- flags: Flag emoji + names

## Assistant

Answers captured. Building a dark, vibrant World Cup 2026 knockout predictor (32-team bracket, click-to-advance, model win-%, clean live-data hook) with three switchable layouts. I'll make the match card a reusable child component, then the main shell.

_[tool: update_todos]_

Now the child match card:

_[tool: dc_write]_

Now the main predictor shell with all three layouts:

_[tool: dc_write]_

_[tool: show_html]_

_[tool: show_html]_

Renders cleanly — classic two-sided bracket with live scores (Argentina 3–0 FT), win-% bars, and the converging columns all working. Marking done and verifying.

_[tool: update_todos]_

Done. A dark, vibrant **World Cup 2026 Bracket Predictor** with the full 32-team knockout (Round of 32 → Final).

**What it does**
- Tap any team to send them through; downstream rounds update automatically, and changing an earlier pick clears anything that depended on it.
- Each matchup shows a model **win-%** (from team ratings) with a split bar, plus live scores and status (LIVE 63′ / FULL TIME).
- Header tracks your champion + progress (`X / 31 winners picked`); Reset clears the bracket.

**Three layouts** via the switcher: **Classic** (iconic two-sided bracket converging on the champion), **Flow** (left-to-right scrolling columns), **Focus** (round-by-round, mobile-friendly).

**Tweaks**: `showProb` toggles the percentages, `pickColor` changes the winner highlight.

**Live-data hook**: scores are mock right now — wire a real feed by calling `setLive({ 'R32-1': {a:2,b:1,status:'FT'} })` (the `liveResults` map / `setLive` method are commented in the logic). Teams, flags, ratings, and seeding are placeholders you can edit once the real draw is set.

Next steps if useful: auto-advance the actual winner when a score goes FT, a "predictions vs. results" accuracy score, or connecting a real fixtures API.

_[tool: ready_for_verification]_

Ready for you to try in the preview.

## User

Can you look up the actual tournament for World Cup 2026 and see if this matches that schema?

## Assistant

_[tool: web_search]_

I checked it against the live tournament (the group stage is actually underway right now — June 11–27, with knockouts starting June 28). Here's how your current build compares:

**✅ What matches**
- 48 teams in 12 groups of four, with the teams that finish first and second in each of the 12 groups qualifying for the Round of 32, along with the eight best third-placed teams.
- The round progression is correct: the Round of 32, Round of 16, quarter-finals, semi-finals and World Cup Final.
- Single-elimination with extra time + penalties. ✓

**❌ What doesn't match**
1. **Missing the third-place match.** The real knockout has 32 matches in the knockout stage, including a match for third place — played between the two losing semifinalists. My bracket has 31 and no third-place playoff.
2. **R32 pairings are simplified.** The real draw has a specific rule: four of the group winners play group runners-up, the other eight group winners play advancing 3rd-placed teams, and the remaining group runners-up play other group runners-up. The matchups also depend on which third-placed teams advance — the specific matchups involving the third-placed teams depend on which eight third-placed teams qualify, with 495 possible combinations published in the regulations. My bracket uses a generic seeded pairing instead.
3. **The bracket feed topology is simplified.** The official bracket doesn't feed consecutively (e.g. R16 match 89 = winner of match 74 vs winner of match 77, not 73 vs 74). Mine uses straight `2n-1 / 2n` feeding.
4. **Team list is placeholder.** Some of my teams (e.g. Belgium, Serbia, Poland, Denmark) aren't in this tournament, and it's missing actual qualifiers like Curaçao, Cape Verde, Uzbekistan, Panama, Jordan, Norway, New Zealand, Paraguay. Real groups are A–L.

**One catch:** the actual R32 matchups aren't locked yet — they're decided when the group stage ends June 27, so right now even FIFA's bracket shows slots like "Winner A", "Runner-up B", "3rd C/E/F/H/I" rather than named teams.

So your prototype is structurally close but is a generic seeded bracket, not the official 2026 format.

I can rebuild it to match the real thing:
- **Real bracket schema** — official R32 slot definitions (Winner/Runner-up/3rd-place placeholders), the correct feed mapping, and a third-place match.
- **Real groups & teams** — populate with the actual 48 (or the qualified ones so far), updating as groups finalize.
- Keep all the interaction (click-to-advance, win-%, three layouts) and the live-data hook so it fills in real teams as the group stage finishes.

Want me to do that rebuild? And should I show the bracket with group-position placeholders now (matching FIFA's current view) and let the live feed swap in real teams, or wait and hardcode the matchups once they're set on June 27?

## User

I would like to see the potential teams that will make the playoffs as well and their probability of being in that game. If there are any teams that have clinched they should be automatically filled in.

## Assistant

Good direction — this needs real, current group-stage data (the tournament is mid-group-stage right now). Let me pull the live standings, who's clinched, and the official bracket slot structure before I build the model.I've got the exact official bracket now — all 16 R32 slot definitions (e.g. M74 = Winner E vs best 3rd from A/B/C/D/F), the R16→QF→SF feed mapping, and the third-place match. Let me pull current group standings so I know who's clinched and who the live candidates are for each slot.I now have everything: the real draw (all 12 groups), the exact official R32 slot definitions, the R16→Final feed map, and the third-place match. The group tables on Wikipedia show zeros (live scores aren't in the cached snapshot), so I'll seed the results I can confirm from match reports and make every score editable — the model recomputes live.

This is a substantial rebuild. Let me lay out the plan, then build the projection engine + rewire the bracket.

_[tool: update_todos]_

_[tool: web_fetch]_

_[tool: web_fetch]_

_[tool: web_fetch]_

_[tool: snip]_

_[tool: web_fetch]_

I can't open that one — The Athletic/NYT blocks automated access (and it's paywalled), so I'm not able to read their projection. If you want my bracket to mirror theirs specifically, paste a screenshot or the key numbers (each group's qualification %s) and I'll line my model up to them.

Otherwise I'll proceed with my own projection engine — same concept (each slot's likely occupants + probabilities, clinched teams auto-filled), computed from current results + team ratings. Building it now.

Let me write the data + projection engine:

_[tool: write_file]_

Encoded all the official structure into the engine. Snipping the big research dumps now that the data lives in a file.

_[tool: snip]_

Now rewrite the Matchup card to show slot labels, occupancy %, clinch locks, and a candidate-swap panel:

_[tool: dc_write]_

_[tool: dc_html_str_replace]_

Now the main rewrite — wiring the engine into the bracket with real slots, auto-fill, candidate swaps, and a group-stage probabilities panel:

_[tool: dc_write]_

Now I understand exactly what you want — The Athletic's per-slot **candidate lists with probability bars**: each Round-of-32 slot shows its top contenders (e.g. "3rd from Groups A, B, C, D or F" → Paraguay 32%, Australia 28%, Scotland 24%), clinched teams marked with ✓, and a match/venue header. Let me rebuild the card to that information design (keeping your dark theme).

First, venue/date data:

_[tool: str_replace_edit]_

Now rebuild the Matchup card — Athletic-style candidate lists with bars:

_[tool: dc_write]_

_[tool: dc_html_str_replace]_

Now rewire the parent to feed the new slot/candidate structure and widen the cards:

_[tool: read_file]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now widen the cards for the taller candidate-list layout:

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Let me see how it renders:

_[tool: show_html]_

Syntax error — a missing paren in one of the score-stepper handlers. Let me fix it:

_[tool: dc_js_str_replace]_

## Assistant

## User

Continue

## Assistant

Let me check the current render state after the syntax fix.

_[tool: show_html]_

I'm fixing a bug (the syntax error), so I'll screenshot to confirm it's resolved.

_[tool: show_html]_

Bug fixed, Athletic-style candidate lists rendering well — Germany clinched, candidates with probability bars. But the team names are truncating ("S...", "C..."). The 84px bars eat too much width. Let me check the group odds view, then tighten the layout.

_[tool: show_html]_

Let me narrow the probability bars so team names have room to breathe.

_[tool: dc_html_str_replace]_

Let me switch to the Group odds view to verify that panel renders correctly.

_[tool: eval_js]_

_[tool: screenshot]_

Group odds panel works great — standings, advance probabilities, clinch markers (✓ in), editable score steppers. Let me verify the name-truncation fix on the bracket and confirm score-editing recomputes.

_[tool: eval_js]_

_[tool: screenshot]_

Names still truncating and bars look unchanged — the child DC may not have picked up the edit. Let me reload fresh.

_[tool: show_html]_

Now everything renders correctly — Athletic-style candidate lists (Scotland 15%, Canada 11%, Bosnia 11% for the 3rd-place slot), Germany clinched, full team names, probability bars. The candidate-list design supersedes the swap-menu idea — you tap any contender directly to send them through.

_[tool: update_todos]_

Rebuilt to match The Athletic's projection model. Snipping the iteration screenshots now that it's settled.

_[tool: snip]_

_[tool: ready_for_verification]_

Done — rebuilt to mirror The Athletic's projection model.

**What changed**
- **Real WC2026 data**: all 12 groups, the actual draw, and FIFA's official Round-of-32 slot rules (e.g. Match 74 = "Winner E vs 3rd from A/B/C/D/F"), the R16→Final feed map, and the third-place match.
- **Monte-Carlo engine** (`wc-data.js`): 3,000 simulations of the remaining group games produce each team's advance odds and each slot's candidate probabilities. Clinched teams (✓) auto-fill; everyone else shows their % chance of landing in that slot.
- **Athletic-style match cards**: each slot lists its top contenders with probability bars (Scotland 15%, Canada 11%…). Tap any contender to send your pick through; downstream rounds update.
- **Group odds tab**: live standings with advance % per team, plus editable score steppers — change any result and the whole projection (odds, clinches, bracket) recomputes instantly.
- Three bracket layouts (Classic / Flow / Focus) retained.

**Caveats worth knowing**
- Group results are **seeded best-effort as of June 21** and partly approximate — correct any score in *Group odds* to refresh everything. Match 9+ in several groups are still unplayed and simulated.
- Ratings, venues, and third-place slot allocation are model approximations, not official numbers — so percentages won't match The Athletic exactly.
- I couldn't access their page directly (paywall/bot-block), so this mirrors the *concept*, not their precise model.

If you later wire a live feed, replacing the seeded scores in `DEFAULT_RESULTS` (or calling `project(results)` with fresh data) is the only hook needed.

