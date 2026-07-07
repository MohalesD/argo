'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useWorkspace } from '@/lib/useWorkspace';

interface InterviewRow {
  id: string;
  candidate_name: string;
  role: string;
  status: string;
  qstack_id: string;
  created_at: string;
  qstack: { title: string } | null;
}

interface QStackOption {
  id: string;
  title: string;
}

// Interviews (PRD 5.5 entry point): create against a QStack, then start
// a session, which is born 'created' and goes to the live surface where
// the consent gate owns everything that follows.
export default function InterviewsPage() {
  const ws = useWorkspace();
  const router = useRouter();
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [qstacks, setQstacks] = useState<QStackOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [qstackId, setQstackId] = useState('');
  const [justCreatedId, setJustCreatedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const supabase = supabaseBrowser();

  const load = useCallback(async () => {
    if (!ws) return;
    const { data } = await supabase
      .from('interviews')
      .select('id, candidate_name, role, status, qstack_id, created_at, qstack:qstacks(title)')
      .eq('org_id', ws.orgId)
      .order('created_at', { ascending: false });
    setInterviews(((data ?? []) as unknown as InterviewRow[]));
    const { data: stacks } = await supabase
      .from('qstacks')
      .select('id, title')
      .eq('org_id', ws.orgId)
      .order('created_at', { ascending: false });
    setQstacks((stacks as QStackOption[]) ?? []);
  }, [ws, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveInterview(e: React.FormEvent) {
    e.preventDefault();
    if (!qstackId) return;
    setBusy(true);
    setError('');
    // Resolve the org at call time rather than gating on the async
    // workspace hook; a fast submit must not silently no-op.
    let orgId = ws?.orgId;
    if (!orgId) {
      const { data: m } = await supabase
        .from('org_members')
        .select('org_id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      orgId = (m?.org_id as string) ?? undefined;
    }
    if (!orgId) {
      setError('could not find your workspace; try again');
      setBusy(false);
      return;
    }
    const { data, error: err } = await supabase
      .from('interviews')
      .insert({
        org_id: orgId,
        qstack_id: qstackId,
        candidate_name: candidateName,
      })
      .select('id')
      .single();
    setBusy(false);
    if (err || !data) {
      setError(err?.message ?? 'save failed');
      return;
    }
    setJustCreatedId(data.id);
    setCandidateName('');
    await load();
  }

  async function startSession(interviewId: string) {
    const { data, error: err } = await supabase
      .from('interview_sessions')
      .insert({ interview_id: interviewId })
      .select('id')
      .single();
    if (err || !data) {
      setError(err?.message ?? 'could not start the session');
      return;
    }
    router.push(`/live/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl">Interviews</h1>
        <button
          data-testid="new-interview"
          onClick={() => setFormOpen(true)}
          className="ml-auto rounded-lg bg-gold px-4 py-2 font-medium hover:bg-gold-hover"
        >
          New interview
        </button>
      </div>

      {formOpen ? (
        <form
          onSubmit={saveInterview}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-4 shadow-card"
        >
          <label className="flex min-w-48 flex-1 flex-col gap-1">
            <span className="text-sm font-medium">Candidate name</span>
            <input
              data-testid="interview-candidate-name"
              required
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              className="rounded-lg border border-line px-3 py-2"
            />
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-1">
            <span className="text-sm font-medium">QStack</span>
            <select
              data-testid="interview-qstack"
              required
              value={qstackId}
              onChange={(e) => setQstackId(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2"
            >
              <option value="">Choose a QStack</option>
              {qstacks.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </label>
          <button
            data-testid="interview-save"
            type="submit"
            disabled={busy}
            className="rounded-lg bg-gold px-4 py-2 font-medium hover:bg-gold-hover disabled:opacity-60"
          >
            {busy ? 'Saving...' : 'Save interview'}
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-flag">
          That did not save ({error}). Your entries are still in the form.
        </p>
      ) : null}

      <ul className="mt-6 flex flex-col gap-3">
        {interviews.map((iv) => (
          <li
            key={iv.id}
            data-testid="interview-row"
            aria-label={iv.candidate_name}
            className={`flex items-center gap-4 rounded-lg border bg-white px-5 py-4 shadow-card ${
              justCreatedId === iv.id ? 'border-gold' : 'border-line'
            }`}
          >
            <div>
              <p className="font-medium">{iv.candidate_name}</p>
              <p className="text-sm text-ink-soft">
                {iv.qstack?.title ?? 'QStack'} · {iv.status}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <SessionEntry interviewId={iv.id} onStart={() => void startSession(iv.id)} />
            </div>
          </li>
        ))}
        {interviews.length === 0 ? (
          <li className="rounded-lg border border-line bg-white p-6 text-center text-ink-soft">
            No interviews yet. Create one against a QStack and Argo walks you
            through consent, capture, and scoring live.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function SessionEntry({ interviewId, onStart }: { interviewId: string; onStart: () => void }) {
  const [sessions, setSessions] = useState<{ id: string; state: string }[]>([]);
  useEffect(() => {
    void supabaseBrowser()
      .from('interview_sessions')
      .select('id, state')
      .eq('interview_id', interviewId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setSessions((data as { id: string; state: string }[]) ?? []));
  }, [interviewId]);

  const open = sessions.find((s) => s.state !== 'ended');
  return (
    <>
      {sessions
        .filter((s) => s.state === 'ended')
        .slice(0, 1)
        .map((s) => (
          <a key={s.id} href={`/live/${s.id}`} className="text-sm text-forest underline">
            View ended session
          </a>
        ))}
      {open ? (
        <a
          href={`/live/${open.id}`}
          className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-gold"
        >
          Resume session
        </a>
      ) : (
        <button
          data-testid="start-session"
          onClick={onStart}
          className="rounded-lg bg-forest px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Start session
        </button>
      )}
    </>
  );
}
