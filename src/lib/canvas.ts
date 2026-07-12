// Shared row contract for public.canvas_positions (migration 0015).
//
// LOCKED PRODUCT RULE, permanent: canvas position is spatial memory
// only. It must never feed ordering, ranking, sorting, or any scored
// or assessed output, anywhere in Argo. Exactly one of qstack_id or
// deck_id is set per row (XOR CHECK in the schema). Deck membership
// never deletes or alters a position row: a stack that leaves a deck
// reappears at its remembered position.

export interface CanvasPositionRow {
  id: string;
  qstack_id: string | null;
  deck_id: string | null;
  x: number;
  y: number;
  created_at: string;
}
