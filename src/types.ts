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

export interface MatchView {
  headerLeft: string;
  headerDate: string;
  headerRight: string;
  slotA: SlotView;
  slotB: SlotView;
  highlight: boolean;
  pickColor: string;
}

/** match number -> picked team code */
export type Picks = Record<number, string>;
