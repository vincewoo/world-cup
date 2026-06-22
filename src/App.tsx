import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { DEFAULT_RESULTS, TEAMS, project, type Projection, type Results, type Score } from './data/wc-data';
import { cleanup, type VMContext } from './viewmodel';
import { focusRounds, focusTabLabel } from './rounds';
import { fetchLiveResults, LIVE_REFRESH_MS, type LiveSyncResult } from './data/liveData';
import { Bracket } from './components/Bracket';
import { GroupOdds } from './components/GroupOdds';
import { Hover } from './components/Hover';
import { loadPicks, savePicks, shareUrl } from './share';
import type { Picks } from './types';

const PICK_COLOR = '#63e06f';

function cloneDefault(): Results {
  const r: Results = {};
  Object.keys(DEFAULT_RESULTS).forEach((k) => (r[k] = DEFAULT_RESULTS[k].map((x) => (x ? { ...x } : null))));
  return r;
}

// ── tab styling helpers (from renderVals) ────────────────────────────────────
function tabStyle(on: boolean): CSSProperties {
  return {
    padding: '8px 15px', borderRadius: 999, border: `1px solid ${on ? '#3a4150' : 'transparent'}`,
    background: on ? '#1b1f28' : 'transparent', color: on ? '#eef1f6' : '#8a93a6',
    font: "600 13px/1 'Space Grotesk'", cursor: 'pointer', transition: 'all .12s',
  };
}
function rTab(on: boolean, acc: string): CSSProperties {
  return {
    padding: '7px 13px', borderRadius: 999, font: "600 12px/1 'Space Grotesk'", cursor: 'pointer',
    border: `1px solid ${on ? acc : '#20242e'}`, background: on ? acc + '22' : '#101319',
    color: on ? acc : '#8a93a6',
  };
}
const pillGroup: CSSProperties = {
  display: 'flex', gap: 5, background: '#101319', border: '1px solid #20242e', borderRadius: 999, padding: 4,
};

const FOOTNOTE =
  'Win % and qualification odds are model estimates (team-rating Monte-Carlo, 3,000 runs), not official. ' +
  'Group results are seeded as of June 21, 2026 and partly approximate — correct any score under “Group odds” ' +
  'to refresh the whole projection. Round-of-32 slot rules follow FIFA’s official bracket; third-placed ' +
  'allocations are approximated. Once the live feed is connected, confirmed knockout matchups and results ' +
  'are pulled from the API and locked in (replacing the projection round by round).';
const SUBLINE =
  'Group stage in progress — slots show each team’s chance to land there, from 3,000 simulations. ' +
  'Clinched teams (✓) are locked in; tap any other team to send your pick through.';

export default function App() {
  const [results, setResults] = useState<Results | null>(null);
  const [proj, setProj] = useState<Projection | null>(null);
  const [picks, setPicks] = useState<Picks>(loadPicks);
  const [shared, setShared] = useState(false);
  const [layout, setLayout] = useState<'classic' | 'flow' | 'focus'>('classic');
  const [view, setView] = useState<'bracket' | 'groups'>('bracket');
  const [focus, setFocus] = useState(0);

  const [live, setLive] = useState<LiveSyncResult | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [autoLive, setAutoLive] = useState(false);
  const [lockedSlots, setLockedSlots] = useState<Record<string, string>>({});

  // Initial load — deferred a frame so the "running simulations" loader paints.
  useEffect(() => {
    const id = setTimeout(() => setResults(cloneDefault()), 30);
    return () => clearTimeout(id);
  }, []);

  // Recompute the projection (and prune now-invalid picks) on any results change.
  useEffect(() => {
    if (!results) return;
    setProj(project(results));
    setPicks((p) => {
      const np = { ...p };
      cleanup(np);
      return np;
    });
  }, [results]);

  // Mirror picks to localStorage so a refresh restores the bracket.
  useEffect(() => {
    savePicks(picks);
  }, [picks]);

  const syncLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const r = await fetchLiveResults();
      setLive(r);
      if (r.source === 'live') {
        setResults(r.results); // re-projects via the effect above
        setLockedSlots(r.lockedSlots); // confirmed R32 matchups
        // Auto-advance any knockout match the API has decided.
        if (Object.keys(r.lockedPicks).length) {
          setPicks((p) => {
            const np = { ...p, ...r.lockedPicks };
            cleanup(np);
            return np;
          });
        }
      }
    } finally {
      setLiveLoading(false);
    }
  }, []);

  // Try the live feed once on mount; falls back to seeded data if unavailable.
  useEffect(() => {
    void syncLive();
  }, [syncLive]);

  // Optional auto-refresh polling.
  useEffect(() => {
    if (!autoLive) return;
    const id = setInterval(() => void syncLive(), LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoLive, syncLive]);

  const pick = useCallback((m: number, id: string) => {
    if (!id) return;
    setPicks((s) => {
      const next = { ...s };
      if (next[m] === id) delete next[m];
      else next[m] = id;
      cleanup(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => setPicks({}), []);

  const share = useCallback(() => {
    const url = shareUrl(picks);
    // Keep the address bar in sync so a manual copy/refresh also works.
    try {
      window.history.replaceState(null, '', url);
    } catch {
      /* ignore */
    }
    const flash = () => {
      setShared(true);
      window.setTimeout(() => setShared(false), 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(flash, flash);
    } else {
      flash();
    }
  }, [picks]);

  const setScore = useCallback((g: string, fi: number, val: Score) => {
    setResults((prev) => {
      const base = prev ?? cloneDefault();
      const r: Results = {};
      Object.keys(base).forEach((k) => (r[k] = base[k].map((x) => (x ? { ...x } : null))));
      r[g][fi] = val;
      return r;
    });
  }, []);

  // ── loader ──────────────────────────────────────────────────────────────
  if (!proj || !results) {
    return (
      <div style={shellStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 14 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid #20242e', borderTopColor: '#4fc3f7' }} />
          <div style={{ font: "600 14px/1 'Space Grotesk'", letterSpacing: '.08em', color: '#8a93a6' }}>
            Running 3,000 tournament simulations…
          </div>
        </div>
      </div>
    );
  }

  const ctx: VMContext = { picks, proj, pickColor: PICK_COLOR, pick, lockedSlots };
  const isBracket = view === 'bracket';
  const champId = picks[104];
  const champ = champId ? TEAMS[champId] : null;

  // Live-feed status pill content.
  let dot = '#ffd24a';
  let statusText = 'Seeded data (as of Jun 21, 2026)';
  if (liveLoading) {
    dot = '#4fc3f7';
    statusText = 'Syncing live results…';
  } else if (live?.source === 'live') {
    dot = '#4ee0a0';
    const ko = live.lockedResults
      ? ` · ${live.lockedResults} knockout result${live.lockedResults === 1 ? '' : 's'}`
      : '';
    statusText = `Live · ${live.syncedMatches} group match${live.syncedMatches === 1 ? '' : 'es'}${ko} · ${live.fetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (live?.error) {
    dot = '#ff7ab8';
    statusText = `${live.error} — using seeded data`;
  }

  return (
    <div style={shellStyle}>
      {/* HEADER */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 24px', alignItems: 'flex-end', justifyContent: 'space-between', padding: '24px 28px 0' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: "600 11px/1 'Space Grotesk'", letterSpacing: '.2em', textTransform: 'uppercase', color: '#8a93a6' }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: '#ff7ab8' }} />
            <span style={{ width: 7, height: 7, borderRadius: 2, background: '#4fc3f7' }} />
            <span style={{ width: 7, height: 7, borderRadius: 2, background: '#4ee0a0' }} />
            FIFA World Cup 2026 · Live projection
          </div>
          <h1 style={{ margin: '9px 0 0', font: "700 34px/1 'Space Grotesk'", letterSpacing: '-.025em', color: '#f4f7fb' }}>Bracket Predictor</h1>
          <div style={{ marginTop: 9, font: "500 12px/1.5 'Space Grotesk'", color: '#697283', maxWidth: 520 }}>{SUBLINE}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ font: "600 10px/1 'Space Grotesk'", letterSpacing: '.16em', textTransform: 'uppercase', color: '#737d90', marginBottom: 7 }}>Your champion</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 24, lineHeight: 1 }}>{champ ? champ.f : '🏆'}</span>
              <span style={{ font: "700 19px/1 'Space Grotesk'", color: champ ? '#f4f7fb' : '#697283' }}>{champ ? champ.n : '—'}</span>
            </div>
          </div>
          <Hover
            as="button"
            onClick={share}
            style={{ padding: '9px 15px', borderRadius: 999, border: '1px solid #2a2f3b', background: 'transparent', color: shared ? '#4ee0a0' : '#aeb6c6', font: "600 12px/1 'Space Grotesk'", cursor: 'pointer' }}
            hoverStyle={{ background: '#1b1f28', color: shared ? '#4ee0a0' : '#eef1f6' }}
          >
            {shared ? 'Copied!' : 'Share'}
          </Hover>
          <Hover
            as="button"
            onClick={reset}
            style={{ padding: '9px 15px', borderRadius: 999, border: '1px solid #2a2f3b', background: 'transparent', color: '#aeb6c6', font: "600 12px/1 'Space Grotesk'", cursor: 'pointer' }}
            hoverStyle={{ background: '#1b1f28', color: '#eef1f6' }}
          >
            Reset picks
          </Hover>
        </div>
      </div>

      {/* CONTROL BAR */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 16px', alignItems: 'center', padding: '20px 28px 4px' }}>
        <div style={pillGroup}>
          {([['bracket', 'Bracket'], ['groups', 'Group odds']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setView(k)} style={tabStyle(view === k)}>{label}</button>
          ))}
        </div>
        {isBracket && (
          <div style={pillGroup}>
            {([['classic', 'Classic'], ['flow', 'Flow'], ['focus', 'Focus']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setLayout(k)} style={tabStyle(layout === k)}>{label}</button>
            ))}
          </div>
        )}
        {isBracket && layout === 'focus' && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {focusRounds.map((r, i) => (
              <button key={i} onClick={() => setFocus(i)} style={rTab(i === focus, r.accent)}>{focusTabLabel(r.name)}</button>
            ))}
          </div>
        )}
      </div>

      {/* LIVE-DATA CONTROL (new — wires the football-data.org feed) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 28px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#101319', border: '1px solid #20242e', borderRadius: 999, padding: '6px 12px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flex: 'none' }} />
          <span style={{ font: "600 11px/1 'Space Grotesk'", color: '#aeb6c6' }}>{statusText}</span>
        </div>
        <Hover
          as="button"
          onClick={() => { if (!liveLoading) void syncLive(); }}
          style={{ padding: '7px 13px', borderRadius: 999, border: '1px solid #2a2f3b', background: 'transparent', color: liveLoading ? '#5a6373' : '#aeb6c6', font: "600 11px/1 'Space Grotesk'", cursor: liveLoading ? 'default' : 'pointer' }}
          hoverStyle={liveLoading ? {} : { background: '#1b1f28', color: '#eef1f6' }}
        >
          {liveLoading ? 'Refreshing…' : 'Refresh live'}
        </Hover>
        <button onClick={() => setAutoLive((v) => !v)} style={rTab(autoLive, '#4ee0a0')}>
          {autoLive ? 'Auto-refresh: on' : 'Auto-refresh: off'}
        </button>
      </div>

      {/* VIEWS */}
      {isBracket ? <Bracket ctx={ctx} layout={layout} focus={focus} /> : <GroupOdds results={results} proj={proj} setScore={setScore} />}

      <div style={{ padding: '6px 28px 24px', font: "500 11px/1.5 'Space Grotesk'", color: '#5a6373', maxWidth: 760 }}>{FOOTNOTE}</div>
    </div>
  );
}

const shellStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'radial-gradient(120% 80% at 50% -10%,#15171f 0%,#0a0c10 55%)',
  color: '#eef1f6',
  fontFamily: "'Space Grotesk',sans-serif",
  paddingBottom: 10,
};
