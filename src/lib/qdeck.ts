// Shared row contract for public.qdecks (migrations 0014, 0016),
// following the brief.ts precedent: one definition, imported by any
// surface that touches decks. A stack belongs to at most one deck;
// qstacks.deck_id is nullable and null means loose. star_count is the
// cached deck-owned star total; the seal rule is the same as stacks
// (25 or more earns it), and decks never carry the fleece edge, which
// is why there is no status field here.

export interface QDeckRow {
  id: string;
  org_id: string;
  owner_id: string;
  title: string;
  star_count: number;
  created_at: string;
}
