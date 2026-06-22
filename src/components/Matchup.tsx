import { type CSSProperties } from 'react';
import type { MatchView, RawRow } from '../types';
import { Hover } from './Hover';

// Reusable match card — Athletic-style candidate lists with probability bars.
// Faithful port of Matchup.dc.html: same layout, fonts, colors, and the same
// buildRow style logic (clinched / picked / placeholder / probability states).

function hexA(h: string, a: number): string {
  let s = String(h).replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

interface BuiltRow {
  onPick: (() => void) | null;
  rowStyle: CSSProperties;
  hoverStyle?: CSSProperties;
  checkStyle: CSSProperties;
  nameStyle: CSSProperties;
  rightStyle: CSSProperties;
  rightLabel: string;
  barStyle: CSSProperties;
  bar: boolean;
  flag: string;
  name: string;
}

function buildRow(row: RawRow | undefined, pickColor: string): BuiltRow {
  const r = row || ({} as RawRow);
  const picked = !!r.picked, ph = !!r.placeholder, clin = !!r.clinched;

  const base: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 8,
    transition: 'background .12s,box-shadow .12s', userSelect: 'none', marginBottom: 2,
  };

  let rowStyle: CSSProperties;
  let hoverStyle: CSSProperties | undefined = { background: 'rgba(255,255,255,.04)' };
  if (ph) {
    rowStyle = { ...base, cursor: 'default', opacity: 0.4 };
    hoverStyle = undefined;
  } else if (picked) {
    rowStyle = {
      ...base, cursor: 'pointer', background: hexA(pickColor, 0.16),
      boxShadow: `inset 0 0 0 1px ${hexA(pickColor, 0.5)}`,
    };
    hoverStyle = { background: hexA(pickColor, 0.22) };
  } else {
    rowStyle = { ...base, cursor: 'pointer' };
  }

  const checkStyle: CSSProperties = picked
    ? { width: 11, flex: 'none', font: "700 10px/1 'Space Grotesk'", color: pickColor, textAlign: 'center' }
    : { width: 11, flex: 'none', fontSize: 0 };

  const nameStyle: CSSProperties = {
    flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    font: `${picked || clin ? '700' : '500'} 13px/1.15 'Space Grotesk'`,
    color: ph ? '#6a7488' : picked ? '#f3f8f4' : '#dde2ec',
  };

  let rightLabel = '';
  let rightStyle: CSSProperties = {
    flex: 'none', font: "700 11px/1 'Space Grotesk'", fontVariantNumeric: 'tabular-nums',
    width: 40, textAlign: 'right',
  };
  if (clin) {
    rightLabel = '✓ Clinched';
    rightStyle = {
      flex: 'none', font: "700 9px/1 'Space Grotesk'", letterSpacing: '.04em',
      color: pickColor, width: 'auto', textAlign: 'right',
    };
  } else if (r.bar) {
    const prob = r.prob ?? 0;
    rightLabel = (prob < 1 ? '<1' : Math.round(prob)) + '%';
    rightStyle = { ...rightStyle, color: prob >= 50 ? '#cfd5e0' : '#828b9d' };
  }

  const barStyle: CSSProperties = {
    height: '100%', borderRadius: 3, width: `${Math.max(2, Math.round(r.prob || 0))}%`,
    background: picked ? pickColor : hexA(pickColor, 0.62),
  };

  return {
    onPick: r.onPick && !ph ? r.onPick : null,
    rowStyle, hoverStyle, checkStyle, nameStyle, rightStyle, rightLabel, barStyle,
    bar: !!r.bar, flag: r.flag || '', name: r.name || '',
  };
}

function Row({ row, pickColor }: { row: RawRow; pickColor: string }) {
  const b = buildRow(row, pickColor);
  return (
    <Hover style={b.rowStyle} hoverStyle={b.hoverStyle} onClick={b.onPick}>
      <span style={b.checkStyle}>✓</span>
      <span style={{ fontSize: 15, lineHeight: 1, width: 20, textAlign: 'center', flex: 'none' }}>{b.flag}</span>
      <span style={b.nameStyle}>{b.name}</span>
      {b.bar && (
        <div style={{ width: 52, height: 6, borderRadius: 3, background: '#222733', overflow: 'hidden', flex: 'none' }}>
          <div style={b.barStyle} />
        </div>
      )}
      <span style={b.rightStyle}>{b.rightLabel}</span>
    </Hover>
  );
}

const labelStyle: CSSProperties = {
  font: "600 9px/1.1 'Space Grotesk'", letterSpacing: '.06em', color: '#7c8597', marginBottom: 5,
};

export function Matchup({ match }: { match: MatchView }) {
  const pickColor = match.pickColor || '#63e06f';
  const cardBorder = match.highlight ? hexA(pickColor, 0.4) : '#262b36';

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', background: '#14171e',
        border: `1px solid ${cardBorder}`, borderRadius: 13, padding: '11px 12px 12px',
        fontFamily: "'Space Grotesk',sans-serif",
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
        <span style={{ font: "700 12px/1 'Space Grotesk'", color: '#e2e7f0' }}>
          {match.headerLeft}
          <span style={{ font: "500 11px/1 'Space Grotesk'", color: '#697283', marginLeft: 6 }}>{match.headerDate}</span>
        </span>
        <span style={{ font: "600 10px/1 'Space Grotesk'", letterSpacing: '.06em', color: '#697283' }}>{match.headerRight}</span>
      </div>

      <div style={labelStyle}>{match.slotA.label}</div>
      {match.slotA.rows.map((row, i) => (
        <Row key={'a' + i} row={row} pickColor={pickColor} />
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '7px 0 6px' }}>
        <div style={{ flex: 1, height: 1, background: '#20242e' }} />
        <span style={{ font: "600 9px/1 'Space Grotesk'", letterSpacing: '.1em', color: '#5a6373' }}>VS</span>
        <div style={{ flex: 1, height: 1, background: '#20242e' }} />
      </div>

      <div style={labelStyle}>{match.slotB.label}</div>
      {match.slotB.rows.map((row, i) => (
        <Row key={'b' + i} row={row} pickColor={pickColor} />
      ))}
    </div>
  );
}
