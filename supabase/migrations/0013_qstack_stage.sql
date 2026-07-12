-- Argo schema track, migration 0013: stage as a real field on the stack.
-- Locked decision: stage is never parsed from a title string. Free text
-- with empty default, matching the role_family/level/methodology house
-- style and the D15 precedent (org-defined vocabularies, no fixed
-- pipeline stages baked into schema).
alter table public.qstacks
  add column stage text not null default '';
