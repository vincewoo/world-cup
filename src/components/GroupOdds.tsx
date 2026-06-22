import { type CSSProperties } from 'react';
import { currentStandings, FIX, FIX_MD, GROUPS, TEAMS, type Projection, type Results, type Score } from '../data/wc-data';
import { pairKey } from '../data/teamNames';
import type { PolymarketSync } from '../data/polymarketData';

const colHead: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 5px',
  font: "600 8px/1 'Space Grotesk'", letterSpacing: '.1em', textTransform: 'uppercase', color: '#5a6373',
};
const num: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

function FixtureRow({
  g, fi, results, setScore, market,
}: { g: string; fi: number; results: Results; setScore: (g: string, fi: number, v: Score) => void; market?: PolymarketSync | null }) {
  const ids = GROUPS[g];
  const pair = FIX[fi];
  const res = results[g][fi];
  const hi = ids[pair[0]], ai = ids[pair[1]];
  const has = !!res;

  // Polymarket moneyline for this fixture, oriented home→away (display only).
  const mk = market?.moneyline[pairKey(hi, ai)];
  const ml = mk
    ? { pHome: mk.teamA === hi ? mk.pA : mk.pB, pAway: mk.teamA === hi ? mk.pB : mk.pA, pDraw: mk.pDraw }
    : null;

  const stepStyle: CSSProperties = {
    width: 17, height: 17, borderRadius: 5, border: '1px solid #2a2f3b', background: '#1b1f28',
    color: '#aeb6c6', font: "700 11px/1 'Space Grotesk'", cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
    ...(has ? {} : { opacity: 0.35, pointerEvents: 'none' }),
  };
  const scoreStyle: CSSProperties = {
    minWidth: 14, textAlign: 'center', font: "700 13px/1 'Space Grotesk'", ...num,
    color: has ? '#eef1f6' : '#4a525f',
  };
  const set = (h: number, a: number) => setScore(g, fi, { h, a });
  const nameStyle: CSSProperties = {
    flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    font: "500 11px/1 'Space Grotesk'", color: '#aeb6c6',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ font: "600 8px/1 'Space Grotesk'", color: '#5a6373', width: 22, flex: 'none' }}>MD{FIX_MD[fi]}</span>
        <span style={{ ...nameStyle, textAlign: 'right' }}>{TEAMS[hi].n}</span>
        <span style={{ fontSize: 13, flex: 'none' }}>{TEAMS[hi].f}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 'none' }}>
          <button onClick={has ? () => set(Math.max(0, res!.h - 1), res!.a) : undefined} style={stepStyle}>−</button>
          <span style={scoreStyle}>{has ? res!.h : '–'}</span>
          <button onClick={has ? () => set(res!.h + 1, res!.a) : undefined} style={stepStyle}>+</button>
          <span style={{ font: "600 10px/1 'Space Grotesk'", color: '#5a6373' }}>:</span>
          <button onClick={has ? () => set(res!.h, Math.max(0, res!.a - 1)) : undefined} style={stepStyle}>−</button>
          <span style={scoreStyle}>{has ? res!.a : '–'}</span>
          <button onClick={has ? () => set(res!.h, res!.a + 1) : undefined} style={stepStyle}>+</button>
        </div>
        <span style={{ fontSize: 13, flex: 'none' }}>{TEAMS[ai].f}</span>
        <span style={nameStyle}>{TEAMS[ai].n}</span>
        <button
          onClick={() => (has ? setScore(g, fi, null) : setScore(g, fi, { h: 0, a: 0 }))}
          style={{
            width: 18, height: 18, flex: 'none', borderRadius: 5, border: '1px solid #2a2f3b',
            background: 'transparent', color: has ? '#737d90' : '#4ee0a0',
            font: "700 12px/1 'Space Grotesk'", cursor: 'pointer', padding: 0,
          }}
        >
          {has ? '×' : '+'}
        </button>
      </div>
      {ml && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          font: "600 9px/1 'Space Grotesk'", color: '#6f93b0', paddingBottom: 2,
        }}>
          <span style={{ color: '#5a6373', letterSpacing: '.06em' }}>MKT</span>
          <span>{Math.round(ml.pHome)}%</span>
          <span style={{ color: '#5a6373' }}>· D {Math.round(ml.pDraw)}% ·</span>
          <span>{Math.round(ml.pAway)}%</span>
        </div>
      )}
    </div>
  );
}

export function GroupOdds({
  results, proj, setScore, market,
}: { results: Results; proj: Projection; setScore: (g: string, fi: number, v: Score) => void; market?: PolymarketSync | null }) {
  const stand = currentStandings(results);
  const tp = proj.teamProb;
  const hasMarket = market?.source === 'live' && Object.keys(market.advance).length > 0;

  return (
    <div style={{ padding: '14px 28px 44px' }}>
      <div style={{ font: "500 12px/1.5 'Space Grotesk'", color: '#697283', maxWidth: 680, marginBottom: 18 }}>
        Each team's chance to advance, from 3,000 simulations of the remaining group games. Tap a score to edit it —
        every probability and the bracket update instantly. Green = clinched.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
        {stand.map((grp) => {
          const playedN = results[grp.g].filter(Boolean).length;
          return (
            <div key={grp.g} style={{ background: '#14171e', border: '1px solid #262b36', borderRadius: 14, padding: '14px 14px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ font: "700 14px/1 'Space Grotesk'", color: '#f4f7fb' }}>Group {grp.g}</span>
                <span style={{ font: "600 9px/1 'Space Grotesk'", letterSpacing: '.12em', textTransform: 'uppercase', color: '#697283' }}>
                  {playedN} / 6 played
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={colHead}>
                  <span style={{ width: 18, flex: 'none' }} />
                  <span style={{ flex: 1 }}>Team</span>
                  <span style={{ width: 26, textAlign: 'center', flex: 'none' }}>Pld</span>
                  <span style={{ width: 30, textAlign: 'center', flex: 'none' }}>GD</span>
                  <span style={{ width: 24, textAlign: 'center', flex: 'none' }}>Pts</span>
                  <span style={{ width: 54, textAlign: 'right', flex: 'none' }}>Model</span>
                  {hasMarket && <span style={{ width: 58, textAlign: 'right', flex: 'none' }}>Market</span>}
                </div>
                {grp.rows.map((r) => {
                  const adv = tp[r.id].adv, clin = adv > 99.99, out = adv === 0;
                  const advColor = clin ? '#63e06f' : out ? '#7a6671' : adv >= 60 ? '#aeb6c6' : adv >= 25 ? '#8a93a6' : '#6a7488';
                  const cut = r.pos <= 2;
                  // Market advance % and its divergence from the model.
                  const mAdv = market?.advance[r.id]?.pct;
                  const diff = mAdv != null ? mAdv - adv : null;
                  const diffColor = diff == null ? '#6a7488'
                    : Math.abs(diff) < 5 ? '#828b9d' : diff > 0 ? '#4ee0a0' : '#ff7ab8';
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 7,
                        ...(cut ? { background: 'rgba(99,224,111,.06)' } : {}),
                      }}
                    >
                      <span style={{ fontSize: 15, lineHeight: 1, width: 18, textAlign: 'center', flex: 'none' }}>{TEAMS[r.id].f}</span>
                      <span
                        style={{
                          flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          font: "600 12px/1.1 'Space Grotesk'",
                          color: r.pos <= 2 ? '#f4f7fb' : r.pos === 3 ? '#cfd5e0' : '#8a93a6',
                        }}
                      >
                        {TEAMS[r.id].n}
                      </span>
                      <span style={{ width: 26, textAlign: 'center', flex: 'none', font: "500 11px/1 'Space Grotesk'", color: '#737d90', ...num }}>{r.pld}</span>
                      <span style={{ width: 30, textAlign: 'center', flex: 'none', font: "500 11px/1 'Space Grotesk'", color: '#8a93a6', ...num }}>{(r.gd > 0 ? '+' : '') + r.gd}</span>
                      <span style={{ width: 24, textAlign: 'center', flex: 'none', font: "700 12px/1 'Space Grotesk'", color: '#e2e7f0', ...num }}>{r.pts}</span>
                      <span style={{ width: 54, textAlign: 'right', flex: 'none', font: "700 12px/1 'Space Grotesk'", color: advColor, ...num }}>
                        {clin ? '✓ in' : out ? 'out' : adv < 1 ? '<1%' : Math.round(adv) + '%'}
                      </span>
                      {hasMarket && (
                        <span style={{ width: 58, textAlign: 'right', flex: 'none', font: "700 11px/1 'Space Grotesk'", color: diffColor, ...num }}
                          title={diff != null ? `Market ${Math.round(mAdv!)}% vs model ${Math.round(adv)}%` : 'No market'}>
                          {mAdv == null ? '–' : `${Math.round(mAdv)}%${diff != null && Math.abs(diff) >= 5 ? ` ${diff > 0 ? '▲' : '▼'}${Math.round(Math.abs(diff))}` : ''}`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, borderTop: '1px solid #20242e', paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {FIX.map((_, fi) => (
                  <FixtureRow key={fi} g={grp.g} fi={fi} results={results} setScore={setScore} market={market} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
