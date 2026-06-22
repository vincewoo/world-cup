// Layout definitions for the three bracket views. Match numbers come straight
// from the design's renderVals (flowColumns / leftColumns / rightColumns / focusRounds).

export const ACC = { A: '#b98cff', C: '#4fc3f7', Q: '#4ee0a0', S: '#ffd24a', F: '#ff7ab8' } as const;

export interface ColumnDef {
  short: string;
  accent: string;
  ms: number[];
}

export const flowColumns: ColumnDef[] = [
  { short: 'Round of 32', accent: ACC.A, ms: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88] },
  { short: 'Round of 16', accent: ACC.C, ms: [89, 90, 91, 92, 93, 94, 95, 96] },
  { short: 'Quarter-finals', accent: ACC.Q, ms: [97, 98, 99, 100] },
  { short: 'Semi-finals', accent: ACC.S, ms: [101, 102] },
  { short: 'Final', accent: ACC.F, ms: [104, 103] },
];

export const leftColumns: ColumnDef[] = [
  { short: 'R32', accent: ACC.A, ms: [74, 77, 73, 75, 83, 84, 81, 82] },
  { short: 'R16', accent: ACC.C, ms: [89, 90, 93, 94] },
  { short: 'QF', accent: ACC.Q, ms: [97, 98] },
  { short: 'SF', accent: ACC.S, ms: [101] },
];

export const rightColumns: ColumnDef[] = [
  { short: 'SF', accent: ACC.S, ms: [102] },
  { short: 'QF', accent: ACC.Q, ms: [99, 100] },
  { short: 'R16', accent: ACC.C, ms: [91, 92, 95, 96] },
  { short: 'R32', accent: ACC.A, ms: [76, 78, 79, 80, 86, 88, 85, 87] },
];

export interface RoundDef {
  name: string;
  accent: string;
  ms: number[];
}

export const focusRounds: RoundDef[] = [
  { name: 'Round of 32', accent: ACC.A, ms: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88] },
  { name: 'Round of 16', accent: ACC.C, ms: [89, 90, 91, 92, 93, 94, 95, 96] },
  { name: 'Quarter-finals', accent: ACC.Q, ms: [97, 98, 99, 100] },
  { name: 'Semi-finals', accent: ACC.S, ms: [101, 102] },
  { name: 'Final & Third place', accent: ACC.F, ms: [104, 103] },
];

// 'Round of 32' -> 'R32'; 'Quarter-finals' -> 'Quarter-finals'; 'Final & Third place' -> 'Final'
export function focusTabLabel(name: string): string {
  return name.split(' ')[0] === 'Round' ? 'R' + name.match(/\d+/)![0] : name.split(' ')[0];
}
