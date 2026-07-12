// Shared row contract for public.qdecks (migration 0014), following the
// brief.ts precedent: one definition, imported by any surface that
// touches decks. A stack belongs to at most one deck; qstacks.deck_id
// is nullable and null means loose.

export interface QDeckRow {
  id: string;
  org_id: string;
  owner_id: string;
  title: string;
  created_at: string;
}
