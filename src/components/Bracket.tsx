import { type CSSProperties } from 'react';
import { Matchup } from './Matchup';
import { matchView, type VMContext } from '../viewmodel';
import { TEAMS } from '../data/wc-data';
import { type ColumnDef, flowColumns, leftColumns, rightColumns, focusRounds } from '../rounds';

const colHeaderLabel: CSSProperties = {
  font: "600 12px/1 'Space Grotesk'", letterSpacing: '.16em', textTransform: 'uppercase', color: '#aeb6c6',
};
const matchesWrap: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'space-around', flex: 1,
};

function Column({ col, ctx, width, align }: { col: ColumnDef; ctx: VMContext; width: number; align: 'left' | 'right' }) {
  const dot = <span style={{ width: 9, height: 9, borderRadius: 2, background: col.accent }} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: width, width }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 15,
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        }}
      >
        {align === 'left' && dot}
        <span style={colHeaderLabel}>{col.short}</span>
        {align === 'right' && dot}
      </div>
      <div style={matchesWrap}>
        {col.ms.map((m) => (
          <Matchup key={m} match={matchView(m, ctx)} />
        ))}
      </div>
    </div>
  );
}

function ChampionCard({ ctx }: { ctx: VMContext }) {
  const champId = ctx.picks[104];
  const champ = champId ? TEAMS[champId] : null;
  return (
    <div
      style={{
        borderRadius: 16, border: '1px solid #2a2f3b',
        background: 'linear-gradient(180deg,#1a1e27,#14171e)', padding: 16, textAlign: 'center',
        boxShadow: '0 0 0 1px rgba(255,210,74,.06),0 14px 40px -18px rgba(255,210,74,.25)',
      }}
    >
      <div style={{ font: "600 10px/1 'Space Grotesk'", letterSpacing: '.18em', textTransform: 'uppercase', color: '#ffd24a', marginBottom: 10 }}>
        Champion
      </div>
      <div style={{ fontSize: 40, lineHeight: 1 }}>{champ ? champ.f : '🏆'}</div>
      <div style={{ font: "700 20px/1.1 'Space Grotesk'", marginTop: 8, color: champ ? '#f4f7fb' : '#697283' }}>
        {champ ? champ.n : '—'}
      </div>
    </div>
  );
}

export function Bracket({ ctx, layout, focus }: { ctx: VMContext; layout: 'classic' | 'flow' | 'focus'; focus: number }) {
  if (layout === 'flow') {
    return (
      <div className="wc-scroll" style={{ overflowX: 'auto', padding: '20px 28px 36px' }}>
        <div style={{ display: 'flex', gap: 30, minWidth: 'max-content', alignItems: 'stretch' }}>
          {flowColumns.map((col, i) => (
            <Column key={i} col={col} ctx={ctx} width={252} align="left" />
          ))}
        </div>
      </div>
    );
  }

  if (layout === 'focus') {
    const fr = focusRounds[focus];
    return (
      <div style={{ padding: '12px 28px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: fr.accent }} />
          <span style={{ font: "700 18px/1 'Space Grotesk'", color: '#f4f7fb' }}>{fr.name}</span>
        </div>
        <div
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(252px,1fr))',
            gap: 16, maxWidth: 1160,
          }}
        >
          {fr.ms.map((m) => (
            <Matchup key={m} match={matchView(m, ctx)} />
          ))}
        </div>
      </div>
    );
  }

  // classic
  return (
    <div className="wc-scroll" style={{ overflowX: 'auto', padding: '20px 28px 36px' }}>
      <div style={{ display: 'flex', gap: 22, minWidth: 'max-content', alignItems: 'stretch' }}>
        {leftColumns.map((col, i) => (
          <Column key={'l' + i} col={col} ctx={ctx} width={248} align="left" />
        ))}

        <div
          style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'stretch',
            gap: 14, minWidth: 250, width: 250, alignSelf: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: '#ff7ab8' }} />
            <span style={{ font: "600 12px/1 'Space Grotesk'", letterSpacing: '.18em', textTransform: 'uppercase', color: '#ff7ab8' }}>
              Final
            </span>
          </div>
          <Matchup match={matchView(104, ctx)} />
          <ChampionCard ctx={ctx} />
          <div style={{ font: "600 10px/1 'Space Grotesk'", letterSpacing: '.16em', textTransform: 'uppercase', color: '#697283', textAlign: 'center', marginTop: 2 }}>
            Third place
          </div>
          <Matchup match={matchView(103, ctx)} />
        </div>

        {rightColumns.map((col, i) => (
          <Column key={'r' + i} col={col} ctx={ctx} width={248} align="right" />
        ))}
      </div>
    </div>
  );
}
