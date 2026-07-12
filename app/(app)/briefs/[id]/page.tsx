'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BriefClaim, BriefContent } from '@/lib/brief';
import { supabaseBrowser } from '@/lib/supabase/client';

interface BriefRow {
  id: string;
  interview_id: string;
  content: BriefContent;
  generated_by_model: string | null;
  status: 'draft' | 'final';
}

interface ResponseInfo {
  id: string;
  response_text: string;
  questionText: string;
}

interface ShareRow {
  id: string;
  token: string;
  expires_at: string;
  revoked_at: string | null;
}

// Brief review surface (PRD 5.7, 5.8): claims with expandable citations
// that resolve to the captured responses, edit before finalize, PDF
// export, and the share dialog whose expiry and revocation controls sit
// next to the link they govern (D13).
export default function BriefPage() {
  const params = useParams<{ id: string }>();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [brief, setBrief] = useState<BriefRow | null>(null);
  const [candidate, setCandidate] = useState('');
  const [role, setRole] = useState('');
  const [responses, setResponses] = useState<Map<string, ResponseInfo>>(new Map());
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState<BriefContent | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [share, setShare] = useState<ShareRow | null>(null);
  const [flash, setFlash] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const { data: b } = await supabase
      .from('briefs')
      .select('id, interview_id, content, generated_by_model, status')
      .eq('id', params.id)
      .maybeSingle();
    if (!b) {
      setNotFound(true);
      return;
    }
    setBrief(b as BriefRow);
    const { data: iv } = await supabase
      .from('interviews')
      .select('candidate_name, role')
      .eq('id', b.interview_id)
      .maybeSingle();
    setCandidate((iv?.candidate_name as string) ?? '');
    setRole((iv?.role as string) ?? '');
    const { data: sessions } = await supabase
      .from('interview_sessions')
      .select('id')
      .eq('interview_id', b.interview_id);
    const ids = (sessions ?? []).map((s) => s.id as string);
    if (ids.length) {
      const { data: resp } = await supabase
        .from('responses')
        .select('id, response_text, question:questions(text)')
        .in('session_id', ids);
      const map = new Map<string, ResponseInfo>();
      for (const r of resp ?? []) {
        map.set(r.id as string, {
          id: r.id as string,
          response_text: r.response_text as string,
          questionText: ((r.question as unknown as { text: string } | null)?.text ?? '').toString(),
        });
      }
      setResponses(map);
    }
    const { data: sh } = await supabase
      .from('brief_shares')
      .select('id, token, expires_at, revoked_at')
      .eq('brief_id', b.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setShare((sh as ShareRow) ?? null);
  }, [params.id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  function note(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2000);
  }

  async function saveEdit() {
    if (!brief || !draftContent) return;
    await supabase.from('briefs').update({ content: draftContent }).eq('id', brief.id);
    setBrief({ ...brief, content: draftContent });
    setEditing(false);
    note('Edits saved');
  }

  async function finalize() {
    if (!brief) return;
    await supabase.from('briefs').update({ status: 'final' }).eq('id', brief.id);
    setBrief({ ...brief, status: 'final' });
    note('Brief finalized');
  }

  async function openShare() {
    if (!brief) return;
    setShareOpen(true);
    if (!share) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('brief_shares')
        .insert({ brief_id: brief.id, created_by: user.id })
        .select('id, token, expires_at, revoked_at')
        .single();
      if (data) setShare(data as ShareRow);
    }
  }

  async function revoke() {
    if (!share) return;
    await supabase
      .from('brief_shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', share.id);
    setShare(null);
    note('Link revoked; the page behind it now shows a dead end');
  }

  if (notFound) {
    return (
      <div className="rounded-lg border border-line bg-white p-8 text-center">
        <h1 className="text-xl">This brief is not available</h1>
        <p className="mt-2 text-ink-soft">
          It may be private to another workspace, or the link is out of date.
          Nothing of yours was lost.
        </p>
        <Link href="/library" className="mt-4 inline-block text-forest underline">
          Back to your library
        </Link>
      </div>
    );
  }
  if (!brief) return <p className="text-ink-soft">Loading brief...</p>;
  const content = editing && draftContent ? draftContent : brief.content;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-ink-soft">Candidate brief</p>
          <h1 className="text-3xl">{candidate}</h1>
          {role ? <p className="text-ink-soft">{role}</p> : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {flash ? <span className="text-sm text-forest">{flash}</span> : null}
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              brief.status === 'final' ? 'bg-forest-soft text-forest' : 'bg-cream text-ink-soft'
            }`}
          >
            {brief.status}
          </span>
          {brief.status === 'draft' ? (
            editing ? (
              <button
                data-testid="brief-save-edit"
                onClick={() => void saveEdit()}
                className="rounded-lg bg-gold px-3 py-1.5 text-sm font-medium hover:bg-gold-hover"
              >
                Save edits
              </button>
            ) : (
              <button
                data-testid="brief-edit"
                onClick={() => {
                  setDraftContent(structuredClone(brief.content));
                  setEditing(true);
                }}
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:border-gold"
              >
                Edit
              </button>
            )
          ) : null}
          {brief.status === 'draft' ? (
            <button
              data-testid="finalize-brief"
              onClick={() => void finalize()}
              disabled={editing}
              className="rounded-lg bg-forest px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              Finalize
            </button>
          ) : null}
          <a
            data-testid="export-pdf"
            href={`/api/briefs/${brief.id}/pdf`}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:border-gold"
          >
            Export PDF
          </a>
          {brief.status === 'final' ? (
            <button
              data-testid="share-brief"
              onClick={() => void openShare()}
              className="rounded-lg bg-gold px-3 py-1.5 text-sm font-medium hover:bg-gold-hover"
            >
              Share
            </button>
          ) : null}
        </div>
      </div>

      {shareOpen ? (
        <ShareDialog share={share} onRevoke={() => void revoke()} onClose={() => setShareOpen(false)} />
      ) : null}

      {content.role_context ? (
        <section data-testid="brief-section" className="mt-6">
          <h2 className="font-display text-xl text-forest">Role context</h2>
          <p className="mt-1 text-ink-soft">{content.role_context}</p>
        </section>
      ) : null}

      {content.sections.map((section, si) => (
        <section key={si} data-testid="brief-section" className="mt-6">
          <h2 className="font-display text-xl text-forest">{section.category}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {section.claims.map((claim, ci) => (
              <ClaimView
                key={ci}
                claim={claim}
                responses={responses}
                editing={editing}
                onEdit={(text) => {
                  if (!draftContent) return;
                  const next = structuredClone(draftContent);
                  next.sections[si]!.claims[ci]!.text = text;
                  setDraftContent(next);
                }}
              />
            ))}
          </ul>
        </section>
      ))}

      {content.starred_moments.length > 0 ? (
        <section data-testid="brief-section" className="mt-6">
          <h2 className="font-display text-xl text-forest">Starred moments</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {content.starred_moments.map((claim, ci) => (
              <ClaimView
                key={ci}
                claim={claim}
                starred
                responses={responses}
                editing={editing}
                onEdit={(text) => {
                  if (!draftContent) return;
                  const next = structuredClone(draftContent);
                  next.starred_moments[ci]!.text = text;
                  setDraftContent(next);
                }}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {content.open_questions.length > 0 ? (
        <section data-testid="brief-section" className="mt-6">
          <h2 className="font-display text-xl text-forest">Open questions for the team</h2>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
            {content.open_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="mt-8 border-t border-line pt-4 text-xs text-ink-soft">
        {brief.generated_by_model
          ? `Drafted with ${brief.generated_by_model}; every claim cites a captured response. `
          : ''}
        Argo structures what was said. It contains no AI scores, rankings, or
        hire recommendations; those decisions stay human.
      </p>
    </div>
  );
}

function ClaimView({
  claim,
  responses,
  editing,
  onEdit,
  starred,
}: {
  claim: BriefClaim;
  responses: Map<string, ResponseInfo>;
  editing: boolean;
  onEdit: (text: string) => void;
  starred?: boolean;
}) {
  return (
    <li
      data-testid="brief-claim"
      className={`rounded-lg border border-line bg-white p-3 shadow-card ${
        starred ? 'border-l-4 border-l-gold' : ''
      }`}
    >
      {editing ? (
        <textarea
          value={claim.text}
          onChange={(e) => onEdit(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-line px-2 py-1 text-sm"
        />
      ) : (
        <p className="text-sm">{claim.text}</p>
      )}
      <span className="mt-1.5 flex flex-wrap gap-1.5">
        {claim.citations.map((id) => (
          <Citation key={id} id={id} info={responses.get(id)} />
        ))}
      </span>
    </li>
  );
}

function Citation({ id, info }: { id: string; info?: ResponseInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      data-testid="brief-citation"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      className={`rounded-md text-left text-xs transition-colors ${
        open
          ? 'block w-full border border-gold bg-cream p-2'
          : 'inline-block rounded-full bg-cream px-2 py-0.5 text-forest hover:bg-gold-soft'
      }`}
    >
      {open && info ? (
        <>
          <span className="font-semibold text-forest">{info.questionText}</span>
          <span className="mt-1 block text-ink-soft">{info.response_text}</span>
        </>
      ) : open ? (
        <span className="text-ink-soft">This response is not visible to you.</span>
      ) : (
        <>cited response</>
      )}
    </button>
  );
}

function ShareDialog({
  share,
  onRevoke,
  onClose,
}: {
  share: ShareRow | null;
  onRevoke: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = share ? `${window.location.origin}/share/${share.token}` : '';

  return (
    <div
      role="dialog"
      aria-label="Share this brief"
      className="mt-4 rounded-xl border border-gold bg-white p-5 shadow-lift"
    >
      <div className="flex items-center">
        <h2 className="text-lg">Share this brief</h2>
        <button onClick={onClose} aria-label="Close share dialog" className="ml-auto text-ink-soft hover:text-ink">
          Close
        </button>
      </div>
      {share ? (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            Anyone with the link can view without an account. It carries a
            real person&apos;s interview, so it expires and can be revoked
            right here.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-cream p-2">
            <code data-testid="share-link" className="flex-1 overflow-x-auto text-xs">
              {url}
            </code>
            <button
              data-testid="share-copy"
              onClick={() => {
                void navigator.clipboard.writeText(url).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 rounded-lg border border-line bg-white px-2.5 py-1 text-xs hover:border-gold"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span data-testid="share-expiry" className="text-ink-soft">
              Expires {new Date(share.expires_at).toLocaleDateString()} (30 days by default)
            </span>
            <button
              data-testid="share-revoke"
              onClick={onRevoke}
              className="ml-auto rounded-lg border border-line px-3 py-1.5 text-flag hover:border-flag"
            >
              Revoke link
            </button>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">Creating the link...</p>
      )}
    </div>
  );
}
