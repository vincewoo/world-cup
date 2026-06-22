// View-model shapes shared between App (which builds them) and Matchup (which renders them).

export interface RawRow {
  id?: string;
  flag?: string;
  name: string;
  prob?: number | null;
  bar?: boolean;
  clinched?: boolean;
  picked?: boolean;
  placeholder?: boolean;
  onPick?: (() => void) | null;
}

export interface SlotView {
  label: string;
  rows: RawRow[];
}

/** Polymarket-vs-model comparison for a knockout match card. Percentages 0–100;
 *  pA/pDraw/pB are market-implied, modelA/modelB are the Monte-Carlo estimate. */
export interface MarketLine {
  pA: number;
  pDraw: number;
  pB: number;
  modelA: number;
  modelB: number;
}

export interface MatchView {
  headerLeft: string;
  headerDate: string;
  headerRight: string;
  slotA: SlotView;
  slotB: SlotView;
  highlight: boolean;
  pickColor: string;
  market?: MarketLine;
}

/** match number -> picked team code */
export type Picks = Record<number, string>;
