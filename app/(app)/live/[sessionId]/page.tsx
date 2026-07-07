'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useWorkspace } from '@/lib/useWorkspace';

// Live interview mode (PRD 5.5). Locality-First is a hard requirement
// here: the active question, response field, star and highlight
// controls, the anchored score control, score history, and the next-
// question affordance share one visual neighborhood. The consent gate
// is the schema's state machine, wired faithfully: no capture control
// exists in the DOM until the session row itself says 'capturing'.

interface SessionRow {
  id: string;
  state: 'created' | 'consented' | 'capturing' | 'ended';
  interview_id: string;
}

interface InterviewRow {
  id: string;
  candidate_name: string;
  role: string;
  qstack_id: string;
}

interface ItemRow {
  id: string;
  question_id: string;
  position: number;
  rubric: { anchors?: Record<string, string> };
  followups: string[];
  question: { id: string; text: string; category: string };
}

interface ResponseRow {
  id: string;
  question_id: string;
  response_text: string;
  starred: boolean;
  highlights: { type: string; text?: string }[];
}

interface ScoreRow {
  id: string;
  response_id: string;
  value: number;
  anchor: string;
  scorer_id: string;
  supersedes_score_id: string | null;
  created_at: string;
}

export default function LiveSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const search = useSearchParams();
  const ws = useWorkspace();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [session, setSession] = useState<SessionRow | null>(null);
  const [interview, setInterview] = useState<InterviewRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [responses, setResponses] = useState<Map<string, ResponseRow>>(new Map());
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [active, setActive] = useState(0);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    const { data: s } = await supabase
      .from('interview_sessions')
      .select('id, state, interview_id')
      .eq('id', params.sessionId)
      .maybeSingle();
    if (!s) {
      setLoadError(true);
      return;
    }
    setSession(s as SessionRow);
    const { data: iv } = await supabase
      .from('interviews')
      .select('id, candidate_name, role, qstack_id')
      .eq('id', s.interview_id)
      .maybeSingle();
    if (!iv) return;
    setInterview(iv as InterviewRow);
    const { data: rows } = await supabase
      .from('qstack_items')
      .select('id, question_id, position, rubric, followups, question:questions(id, text, category)')
      .eq('qstack_id', iv.qstack_id)
      .order('position');
    const loadedItems = ((rows ?? []) as unknown as ItemRow[]).filter((r) => r.question);
    setItems(loadedItems);
    const { data: resp } = await supabase
      .from('responses')
      .select('id, question_id, response_text, starred, highlights')
      .eq('session_id', s.id);
    const map = new Map<string, ResponseRow>();
    for (const r of (resp ?? []) as ResponseRow[]) map.set(r.question_id, r);
    setResponses(map);
    if (resp && resp.length > 0) {
      const { data: sc } = await supabase
        .from('scores')
        .select('*')
        .in('response_id', (resp as ResponseRow[]).map((r) => r.id))
        .order('created_at', { ascending: true });
      setScores((sc as ScoreRow[]) ?? []);
    }
    // Deep link from a mention notification lands on the exact response.
    const focusResponse = search.get('response');
    if (focusResponse && resp) {
      const target = (resp as ResponseRow[]).find((r) => r.id === focusResponse);
      if (target) {
        const idx = loadedItems.findIndex((it) => it.question_id === target.question_id);
        if (idx >= 0) setActive(idx);
      }
    }
  }, [params.sessionId, supabase, search]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError) {
    return (
      <p className="rounded-lg border border-line bg-white p-6 text-ink-soft">
        This session is not available to you. Nothing was changed.
      </p>
    );
  }
  if (!session || !interview) return <p className="text-ink-soft">Loading session...</p>;

  if (session.state === 'created' || session.state === 'consented') {
    return (
      <ConsentPanel
        session={session}
        interview={interview}
        userId={ws?.userId ?? null}
        onConsented={load}
      />
    );
  }

  if (session.state === 'ended') {
    return <EndedView session={session} interview={interview} />;
  }

  return (
    <CaptureSurface
      session={session}
      interview={interview}
      items={items}
      responses={responses}
      scores={scores}
      active={active}
      setActive={setActive}
      onDataChange={load}
      userId={ws?.userId ?? null}
    />
  );
}

function ConsentPanel({
  session,
  interview,
  userId,
  onConsented,
}: {
  session: SessionRow;
  interview: InterviewRow;
  userId: string | null;
  onConsented: () => Promise<void>;
}) {
  const [interviewerOk, setInterviewerOk] = useState(false);
  const [candidateOk, setCandidateOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const supabase = supabaseBrowser();

  async function confirm() {
    if (!userId) return;
    setBusy(true);
    setError('');
    // Consent records first; the state machine verifies they exist
    // before it allows consented, and re-verifies before capturing.
    const { error: cErr } = await supabase.from('consents').insert([
      { session_id: session.id, party: 'interviewer', method: 'ui_confirmation', recorded_by: userId },
      { session_id: session.id, party: 'candidate', method: 'ui_confirmation', recorded_by: userId },
    ]);
    if (cErr) {
      setError(cErr.message);
      setBusy(false);
      return;
    }
    const step1 = await supabase
      .from('interview_sessions')
      .update({ state: 'consented' })
      .eq('id', session.id);
    const step2 = step1.error
      ? step1
      : await supabase.from('interview_sessions').update({ state: 'capturing' }).eq('id', session.id);
    if (step2.error) {
      setError(step2.error.message);
      setBusy(false);
      return;
    }
    await onConsented();
  }

  return (
    <div
      data-testid="consent-panel"
      className="mx-auto max-w-xl rounded-xl border border-gold bg-white p-8 shadow-lift"
    >
      <h1 className="text-2xl">Before capture starts</h1>
      <p className="mt-2 text-ink-soft">
        Argo records typed notes on {interview.candidate_name}&apos;s responses,
        summarizes them into a brief, and shares that brief with your hiring
        team. Capture can only begin once everyone has agreed.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <label className="flex items-start gap-3 rounded-lg border border-line p-3">
          <input
            data-testid="consent-party-interviewer"
            type="checkbox"
            checked={interviewerOk}
            onChange={(e) => setInterviewerOk(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm">
            I, the interviewer, consent to response capture, summarization,
            and sharing with the hiring team.
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-line p-3">
          <input
            data-testid="consent-party-candidate"
            type="checkbox"
            checked={candidateOk}
            onChange={(e) => setCandidateOk(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm">
            The candidate has been told their responses will be captured,
            summarized, and shared with the hiring team, and has agreed.
          </span>
        </label>
      </div>
      <button
        data-testid="consent-confirm"
        onClick={() => void confirm()}
        disabled={!interviewerOk || !candidateOk || busy || !userId}
        className="mt-6 w-full rounded-lg bg-gold px-4 py-2.5 font-medium hover:bg-gold-hover disabled:opacity-50"
      >
        {busy ? 'Recording consent...' : 'Everyone has agreed; begin capture'}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-flag">
          Consent could not be recorded ({error}). Nothing was captured; try
          again.
        </p>
      ) : null}
    </div>
  );
}

function CaptureSurface({
  session,
  interview,
  items,
  responses,
  scores,
  active,
  setActive,
  onDataChange,
  userId,
}: {
  session: SessionRow;
  interview: InterviewRow;
  items: ItemRow[];
  responses: Map<string, ResponseRow>;
  scores: ScoreRow[];
  active: number;
  setActive: (i: number) => void;
  onDataChange: () => Promise<void>;
  userId: string | null;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const item = items[active];
  const [text, setText] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [scoreState, setScoreState] = useState<'idle' | 'saved'>('idle');
  const [overrideArmed, setOverrideArmed] = useState(false);
  const [mention, setMention] = useState('');
  const [mentionNote, setMentionNote] = useState('');
  const [ending, setEnding] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responseIdRef = useRef<string | null>(null);

  const existing = item ? responses.get(item.question_id) : undefined;

  useEffect(() => {
    setText(existing?.response_text ?? '');
    responseIdRef.current = existing?.id ?? null;
    setSaveState('idle');
    setScoreState('idle');
    setOverrideArmed(false);
    setMentionNote('');
  }, [active, existing]);

  const persistResponse = useCallback(
    async (value: string) => {
      if (!item || !userId) return;
      setSaveState('saving');
      if (responseIdRef.current) {
        await supabase
          .from('responses')
          .update({ response_text: value })
          .eq('id', responseIdRef.current);
      } else {
        const { data } = await supabase
          .from('responses')
          .insert({
            session_id: session.id,
            question_id: item.question_id,
            response_text: value,
            created_by: userId,
          })
          .select('id')
          .single();
        if (data) responseIdRef.current = data.id;
      }
      setSaveState('saved');
      void onDataChange();
    },
    [item, userId, session.id, supabase, onDataChange],
  );

  function onTextChange(value: string) {
    setText(value);
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistResponse(value), 500);
  }

  async function toggleStar() {
    if (!responseIdRef.current) await persistResponse(text);
    if (!responseIdRef.current) return;
    const next = !(existing?.starred ?? false);
    await supabase.from('responses').update({ starred: next }).eq('id', responseIdRef.current);
    await onDataChange();
  }

  async function addHighlight() {
    if (!responseIdRef.current) await persistResponse(text);
    if (!responseIdRef.current) return;
    const selection = window.getSelection()?.toString().trim();
    const highlights = [...(existing?.highlights ?? []), { type: 'highlight', text: selection || text.slice(0, 120) }];
    await supabase.from('responses').update({ highlights }).eq('id', responseIdRef.current);
    await onDataChange();
  }

  async function toggleFlag() {
    if (!responseIdRef.current) await persistResponse(text);
    if (!responseIdRef.current) return;
    const has = (existing?.highlights ?? []).some((h) => h.type === 'flag');
    const highlights = has
      ? (existing?.highlights ?? []).filter((h) => h.type !== 'flag')
      : [...(existing?.highlights ?? []), { type: 'flag' }];
    await supabase.from('responses').update({ highlights }).eq('id', responseIdRef.current);
    await onDataChange();
  }

  const responseScores = scores
    .filter((s) => s.response_id === responseIdRef.current)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const supersededIds = new Set(responseScores.map((s) => s.supersedes_score_id).filter(Boolean));
  const currentScore = responseScores.filter((s) => !supersededIds.has(s.id)).at(-1) ?? null;
  const scoringLocked = currentScore !== null && !overrideArmed;

  async function score(value: number) {
    if (!userId) return;
    if (!responseIdRef.current) await persistResponse(text);
    if (!responseIdRef.current) return;
    const anchor = item?.rubric?.anchors?.[String(value)] ?? '';
    const { error } = await supabase.from('scores').insert({
      response_id: responseIdRef.current,
      scorer_type: 'human',
      scorer_id: userId,
      value,
      anchor,
      supersedes_score_id: overrideArmed && currentScore ? currentScore.id : null,
    });
    if (!error) {
      setScoreState('saved');
      setOverrideArmed(false);
      await onDataChange();
    }
  }

  async function submitMention() {
    if (!mention.trim() || !userId) return;
    if (!responseIdRef.current) await persistResponse(text);
    if (!responseIdRef.current) return;
    const handle = mention.replace(/^@/, '').trim();
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('handle', handle)
      .maybeSingle();
    let targetId = profile?.user_id as string | undefined;
    if (!targetId) {
      const { data: byName } = await supabase
        .from('users')
        .select('id')
        .ilike('first_name', handle)
        .limit(1)
        .maybeSingle();
      targetId = byName?.id as string | undefined;
    }
    if (!targetId) {
      setMentionNote(`No teammate found for "${mention}". Try their @handle.`);
      return;
    }
    const { error } = await supabase.from('mentions').insert({
      response_id: responseIdRef.current,
      mentioned_user_id: targetId,
      author_id: userId,
    });
    setMentionNote(error ? `Mention failed (${error.message}).` : 'Mentioned; they get a link to this exact response.');
    setMention('');
  }

  async function endSession() {
    setEnding(true);
    await supabase.from('interview_sessions').update({ state: 'ended' }).eq('id', session.id);
    await onDataChange();
  }

  if (!item) {
    return (
      <p className="rounded-lg border border-line bg-white p-6 text-ink-soft">
        This QStack has no questions. Add questions to it before running the
        interview.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl">{interview.candidate_name}</h1>
        <span className="text-sm text-ink-soft">
          Question {active + 1} of {items.length}
        </span>
        <button
          data-testid="end-session"
          onClick={() => void endSession()}
          disabled={ending}
          className="ml-auto rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:border-flag hover:text-flag disabled:opacity-60"
        >
          {ending ? 'Ending...' : 'End session'}
        </button>
      </div>

      {/* One visual neighborhood: question, response, marks, score. */}
      <div className="mt-4 rounded-xl border border-line bg-white p-6 shadow-card">
        <p data-testid="live-question" className="font-display text-xl leading-snug">
          {item.question.text}
        </p>

        <div className="mt-4">
          <div className="flex items-center gap-2">
            <label htmlFor="response" className="text-sm font-medium">
              Response notes
            </label>
            <span className="text-xs text-ink-soft" aria-live="polite">
              {saveState === 'saving' ? 'Saving...' : null}
            </span>
            {saveState === 'saved' ? (
              <span data-testid="response-saved" className="text-xs font-medium text-forest">
                Saved
              </span>
            ) : null}
            <span className="ml-auto flex gap-2">
              <button
                data-testid="star-response"
                onClick={() => void toggleStar()}
                aria-pressed={existing?.starred ?? false}
                aria-label={existing?.starred ? 'Unstar this response' : 'Star this response'}
                className={`rounded-lg border px-2.5 py-1 text-sm ${
                  existing?.starred
                    ? 'border-gold bg-gold-soft text-ink'
                    : 'border-line hover:border-gold'
                }`}
              >
                &#9733; {existing?.starred ? 'Starred' : 'Star'}
              </button>
              <button
                data-testid="highlight-response"
                onClick={() => void addHighlight()}
                aria-label="Highlight this response"
                className="rounded-lg border border-line px-2.5 py-1 text-sm hover:border-gold"
              >
                Highlight
              </button>
            </span>
          </div>
          <textarea
            id="response"
            data-testid="response-field"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            rows={5}
            placeholder="Capture what the candidate actually says, as they say it."
            className="mt-2 w-full rounded-lg border border-line px-3 py-2"
          />
          {(existing?.highlights ?? []).filter((h) => h.type === 'highlight').length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {(existing?.highlights ?? [])
                .filter((h) => h.type === 'highlight')
                .map((h, i) => (
                  <span key={i} className="rounded-full bg-gold-soft px-2 py-0.5 text-xs">
                    {h.text?.slice(0, 60)}
                  </span>
                ))}
            </div>
          ) : null}
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Score against the rubric</span>
            {scoreState === 'saved' ? (
              <span data-testid="score-saved" className="text-xs font-medium text-forest">
                Score saved
              </span>
            ) : null}
            <button
              data-testid="score-flag"
              onClick={() => void toggleFlag()}
              aria-pressed={(existing?.highlights ?? []).some((h) => h.type === 'flag')}
              className={`ml-auto rounded-lg border px-2.5 py-1 text-sm ${
                (existing?.highlights ?? []).some((h) => h.type === 'flag')
                  ? 'border-flag bg-flag-soft text-flag'
                  : 'border-line hover:border-flag hover:text-flag'
              }`}
            >
              Flag for review
            </button>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[1, 2, 3, 4].map((v) => (
              <button
                key={v}
                data-testid={`score-anchor-${v}`}
                onClick={() => void score(v)}
                disabled={scoringLocked}
                aria-pressed={currentScore?.value === v}
                className={`rounded-lg border p-2 text-left text-xs leading-snug transition-colors ${
                  currentScore?.value === v
                    ? 'border-gold bg-gold-soft'
                    : 'border-line hover:border-gold'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span className="font-display text-base font-bold">{v}</span>
                <span className="mt-0.5 block text-ink-soft">
                  {item.rubric?.anchors?.[String(v)] ?? ''}
                </span>
              </button>
            ))}
          </div>

          {responseScores.length > 0 ? (
            <div data-testid="score-history" className="mt-3 rounded-lg bg-cream p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink-soft">
                  Score history (append-only; overrides never erase)
                </span>
                <button
                  data-testid="override-score"
                  onClick={() => setOverrideArmed(true)}
                  disabled={overrideArmed}
                  className="ml-auto rounded-lg border border-line bg-white px-2.5 py-1 text-xs hover:border-gold disabled:opacity-60"
                >
                  {overrideArmed ? 'Pick the new score above' : 'Override score'}
                </button>
              </div>
              <ol className="mt-2 flex flex-col gap-1">
                {responseScores.map((s) => (
                  <li
                    key={s.id}
                    data-testid="score-history-entry"
                    className={`text-xs ${supersededIds.has(s.id) ? 'text-ink-soft line-through' : ''}`}
                  >
                    Scored {s.value} of 4
                    {s.anchor ? ` (${s.anchor.slice(0, 60)})` : ''}
                    {supersededIds.has(s.id) ? ' , superseded' : ''}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            <input
              data-testid="mention-input"
              value={mention}
              onChange={(e) => setMention(e.target.value)}
              placeholder="@teammate to pull them into this response"
              className="flex-1 rounded-lg border border-line px-3 py-1.5 text-sm"
            />
            <button
              data-testid="mention-submit"
              onClick={() => void submitMention()}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:border-gold"
            >
              Mention
            </button>
          </div>
          {mentionNote ? <p className="mt-1 text-xs text-ink-soft">{mentionNote}</p> : null}
        </div>

        {item.followups.length > 0 ? (
          <div className="mt-4 rounded-lg bg-forest-soft p-3">
            <p className="text-xs font-semibold text-forest">
              Follow-up suggestions (from this QStack&apos;s pool)
            </p>
            <ul className="mt-1 flex flex-col gap-1 text-sm">
              {item.followups.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-2 border-t border-line pt-4">
          <button
            data-testid="prev-question"
            onClick={() => setActive(Math.max(0, active - 1))}
            disabled={active === 0}
            className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-gold disabled:opacity-40"
          >
            Previous
          </button>
          <button
            data-testid="next-question"
            onClick={() => setActive(Math.min(items.length - 1, active + 1))}
            disabled={active >= items.length - 1}
            className="rounded-lg bg-gold px-4 py-1.5 text-sm font-medium hover:bg-gold-hover disabled:opacity-40"
          >
            Next question
          </button>
        </div>
      </div>
    </div>
  );
}

function EndedView({ session, interview }: { session: SessionRow; interview: InterviewRow }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const [briefId, setBriefId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void supabase
      .from('briefs')
      .select('id')
      .eq('interview_id', interview.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setBriefId(data?.id ?? null));
  }, [supabase, interview.id]);

  async function generate() {
    setGenerating(true);
    setError('');
    const res = await fetch('/api/briefs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id }),
    });
    const data = (await res.json()) as { briefId?: string; error?: string };
    if (!res.ok || !data.briefId) {
      setError(data.error ?? `generation failed (${res.status})`);
      setGenerating(false);
      return;
    }
    router.push(`/briefs/${data.briefId}`);
  }

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-line bg-white p-8 text-center shadow-card">
      <h1 className="text-2xl">Session ended</h1>
      <p className="mt-2 text-ink-soft">
        {interview.candidate_name}&apos;s responses are captured. The brief
        structures what was said, with a citation behind every claim.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        {briefId ? (
          <a
            href={`/briefs/${briefId}`}
            className="rounded-lg bg-gold px-4 py-2 font-medium hover:bg-gold-hover"
          >
            Open the brief
          </a>
        ) : (
          <button
            data-testid="generate-brief"
            onClick={() => void generate()}
            disabled={generating}
            className="rounded-lg bg-gold px-4 py-2 font-medium hover:bg-gold-hover disabled:opacity-60"
          >
            {generating ? 'Drafting with citations...' : 'Generate candidate brief'}
          </button>
        )}
        <a
          href="/interviews"
          className="rounded-lg border border-line px-4 py-2 hover:border-gold"
        >
          Back to interviews
        </a>
      </div>
      {generating ? (
        <p className="mt-3 text-sm text-ink-soft" aria-live="polite">
          Drafting takes up to a minute; every claim is checked against the
          captured responses before it survives.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-flag">
          The brief could not be generated ({error}). Your captured responses
          are safe; try again.
        </p>
      ) : null}
    </div>
  );
}
