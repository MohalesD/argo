'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { BriefContent } from '@/lib/brief';
import { supabaseBrowser } from '@/lib/supabase/client';

interface SharedBrief {
  brief_id: string;
  content: BriefContent;
  status: string;
  candidate_name: string;
  role: string;
  shared_by: string;
  expires_at: string;
  cited_responses: { id: string; question: string; text: string }[];
}

// The PLG loop surface (PRD 5.8): view without an account through the
// tokenized definer function (never a direct table read); any
// interaction prompts a first-name-and-email signup. Dead tokens render
// a respectful dead end that leaks nothing.
export default function SharePage() {
  const params = useParams<{ token: string }>();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [state, setState] = useState<'loading' | 'ok' | 'dead'>('loading');
  const [brief, setBrief] = useState<SharedBrief | null>(null);
  const [authed, setAuthed] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [signupState, setSignupState] = useState<'idle' | 'sending' | 'sent'>('idle');

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc('get_shared_brief', {
        p_token: params.token,
      });
      if (error || !data) {
        setState('dead');
        return;
      }
      setBrief(data as SharedBrief);
      setState('ok');
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setAuthed(!!user);
      if (user) {
        // Conversion instrumentation: an authed arrival through a share
        // link records the invite acceptance (PRD 5.8).
        await supabase.rpc('accept_share_invite', { p_token: params.token });
      }
    })();
  }, [params.token, supabase]);

  async function interact() {
    if (!authed) {
      setSignupOpen(true);
      return;
    }
    await supabase.rpc('accept_share_invite', { p_token: params.token });
    setSaved(true);
  }

  async function signup(e: React.FormEvent) {
    e.preventDefault();
    setSignupState('sending');
    await supabase.auth.signInWithOtp({
      email,
      options: {
        data: { first_name: firstName },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/share/${params.token}`,
      },
    });
    setSignupState('sent');
  }

  if (state === 'loading') {
    return <p className="p-10 text-center text-ink-soft">Opening the brief...</p>;
  }

  if (state === 'dead' || !brief) {
    return (
      <main
        data-testid="share-dead-end"
        className="mx-auto mt-24 max-w-md rounded-xl border border-line bg-white p-8 text-center shadow-card"
      >
        <h1 className="font-display text-2xl">This link is no longer active</h1>
        <p className="mt-2 text-ink-soft">
          The person who shared it may have revoked it, or it expired.
          Candidate briefs carry real interview data, so links do not live
          forever.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-gold px-4 py-2 font-medium hover:bg-gold-hover"
        >
          Go to Argo
        </Link>
      </main>
    );
  }

  const citedById = new Map(brief.cited_responses.map((r) => [r.id, r]));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div data-testid="shared-brief-view">
        <p className="text-xs uppercase tracking-widest text-ink-soft">
          {brief.shared_by} shared a candidate brief with you
        </p>
        <h1 className="mt-1 font-display text-3xl">{brief.candidate_name}</h1>
        {brief.role ? <p className="text-ink-soft">{brief.role}</p> : null}

        {brief.content.role_context ? (
          <section className="mt-6">
            <h2 className="font-display text-xl text-forest">Role context</h2>
            <p className="mt-1 text-ink-soft">{brief.content.role_context}</p>
          </section>
        ) : null}

        {brief.content.sections.map((section, si) => (
          <section key={si} className="mt-6">
            <h2 className="font-display text-xl text-forest">{section.category}</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {section.claims.map((claim, ci) => (
                <SharedClaim key={ci} text={claim.text} citations={claim.citations} citedById={citedById} />
              ))}
            </ul>
          </section>
        ))}

        {brief.content.starred_moments.length > 0 ? (
          <section className="mt-6">
            <h2 className="font-display text-xl text-forest">Starred moments</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {brief.content.starred_moments.map((claim, ci) => (
                <SharedClaim key={ci} starred text={claim.text} citations={claim.citations} citedById={citedById} />
              ))}
            </ul>
          </section>
        ) : null}

        {brief.content.open_questions.length > 0 ? (
          <section className="mt-6">
            <h2 className="font-display text-xl text-forest">Open questions for the team</h2>
            <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
              {brief.content.open_questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      <div className="mt-8 flex items-center gap-3 rounded-xl border border-gold bg-gold-soft p-4">
        <p className="text-sm">
          {saved
            ? 'Saved. This brief is connected to your account.'
            : 'Want to keep this brief, comment, or build your own structured interviews?'}
        </p>
        {!saved ? (
          <button
            data-testid="share-interact"
            onClick={() => void interact()}
            className="ml-auto shrink-0 rounded-lg bg-gold px-4 py-2 text-sm font-medium hover:bg-gold-hover"
          >
            {authed ? 'Save this brief' : 'Save and comment'}
          </button>
        ) : (
          <Link
            href="/library"
            className="ml-auto shrink-0 rounded-lg bg-gold px-4 py-2 text-sm font-medium hover:bg-gold-hover"
          >
            Open your workspace
          </Link>
        )}
      </div>

      {signupOpen && !authed ? (
        <div className="mt-4 rounded-xl border border-line bg-white p-5 shadow-lift">
          {signupState === 'sent' ? (
            <p className="text-sm text-ink-soft">
              Check your email for the sign-in link; it brings you right back
              to this brief.
            </p>
          ) : (
            <>
              <h2 className="text-lg">
                {brief.shared_by} invited you to view the candidate responses.
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                Create a free account in five seconds to view. First name and
                email, nothing else.
              </p>
              <form onSubmit={signup} className="mt-3 flex flex-wrap items-end gap-2">
                <label className="flex flex-1 min-w-36 flex-col gap-1">
                  <span className="text-xs font-medium">First name</span>
                  <input
                    data-testid="share-signup-first-name"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="flex flex-1 min-w-48 flex-col gap-1">
                  <span className="text-xs font-medium">Email</span>
                  <input
                    data-testid="share-signup-email"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm"
                  />
                </label>
                <button
                  data-testid="share-signup-submit"
                  type="submit"
                  disabled={signupState === 'sending'}
                  className="rounded-lg bg-gold px-4 py-1.5 text-sm font-medium hover:bg-gold-hover disabled:opacity-60"
                >
                  {signupState === 'sending' ? 'Sending...' : 'Create free account'}
                </button>
              </form>
            </>
          )}
        </div>
      ) : null}

      <p className="mt-10 text-center text-xs text-ink-soft">
        Structured with <Link href="/" className="text-forest underline">Argo</Link>, the interview
        layer. Every claim cites what the candidate actually said.
      </p>
    </main>
  );
}

function SharedClaim({
  text,
  citations,
  citedById,
  starred,
}: {
  text: string;
  citations: string[];
  citedById: Map<string, { question: string; text: string }>;
  starred?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const resolvable = citations.filter((id) => citedById.has(id));
  return (
    <li
      className={`rounded-lg border border-line bg-white p-3 shadow-card ${
        starred ? 'border-l-4 border-l-gold' : ''
      }`}
    >
      <p className="text-sm">{text}</p>
      {resolvable.length > 0 ? (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-1.5 text-xs text-forest underline"
        >
          {open ? 'Hide cited responses' : `See what was actually said (${resolvable.length})`}
        </button>
      ) : null}
      {open
        ? resolvable.map((id) => {
            const r = citedById.get(id)!;
            return (
              <div key={id} className="mt-2 rounded-md bg-cream p-2 text-xs">
                <p className="font-semibold text-forest">{r.question}</p>
                <p className="mt-0.5 text-ink-soft">{r.text}</p>
              </div>
            );
          })
        : null}
    </li>
  );
}
