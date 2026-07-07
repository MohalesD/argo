'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import BankPanel, { type BankQuestion } from '@/components/qstack/BankPanel';
import { DEFAULT_ANCHORS } from '@/lib/rubric';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useWorkspace } from '@/lib/useWorkspace';

interface QStack {
  id: string;
  title: string;
  role_family: string;
  level: string;
  methodology: string;
  visibility: 'private' | 'org' | 'public';
  forked_from_id: string | null;
  owner_id: string;
  org_id: string;
  star_count: number;
}

interface Item {
  id: string;
  question_id: string;
  position: number;
  rubric: { anchors?: Record<string, string> };
  followups: string[];
  question: {
    id: string;
    text: string;
    category: string;
    rationale: string;
    screening_status: string;
    flag_reason: string | null;
    verification: string | null;
    provenance: Record<string, unknown>;
    contributed_by: string | null;
  };
}

// The QStack surface (PRD 5.2.3): standard view shows every question
// with rubric and follow-ups; a per-question detail disclosure carries
// the rationale so the standard view stays scannable. The bank panel
// sits beside the list: adds land in this stack without leaving it.
export default function QStackPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const ws = useWorkspace();
  const [qstack, setQstack] = useState<QStack | null>(null);
  const [sourceTitle, setSourceTitle] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [savedFlash, setSavedFlash] = useState('');
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const supabase = supabaseBrowser();

  const load = useCallback(async () => {
    const { data: qs } = await supabase
      .from('qstacks')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (!qs) {
      setNotFound(true);
      return;
    }
    setQstack(qs as QStack);
    if (qs.forked_from_id) {
      const { data: src } = await supabase
        .from('qstacks')
        .select('title')
        .eq('id', qs.forked_from_id)
        .maybeSingle();
      setSourceTitle(src?.title ?? 'a QStack no longer visible to you');
    }
    const { data: rows } = await supabase
      .from('qstack_items')
      .select(
        'id, question_id, position, rubric, followups, question:questions(id, text, category, rationale, screening_status, flag_reason, verification, provenance, contributed_by)',
      )
      .eq('qstack_id', params.id)
      .order('position');
    setItems(((rows ?? []) as unknown as Item[]).filter((r) => r.question));
  }, [params.id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  function flash(message: string) {
    setSavedFlash(message);
    setTimeout(() => setSavedFlash(''), 1800);
  }

  const canEdit = !!ws && !!qstack && (qstack.owner_id === ws.userId || qstack.org_id === ws.orgId);

  async function addFromBank(q: BankQuestion) {
    if (!qstack) return;
    const position = Math.max(0, ...items.map((i) => i.position)) + 1;
    const { data, error } = await supabase
      .from('qstack_items')
      .insert({
        qstack_id: qstack.id,
        question_id: q.id,
        position,
        rubric: { anchors: DEFAULT_ANCHORS },
        followups: [],
      })
      .select('id')
      .single();
    if (!error && data) {
      flash('Question added');
      await load();
    }
  }

  async function removeItem(itemId: string) {
    setItems((cur) => cur.filter((i) => i.id !== itemId));
    await supabase.from('qstack_items').delete().eq('id', itemId);
    flash('Question removed');
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    flash('Order saved');
    await Promise.all(
      reordered.map((item, idx) =>
        supabase.from('qstack_items').update({ position: idx + 1 }).eq('id', item.id),
      ),
    );
  }

  // The workspace hook resolves asynchronously; actions must not
  // silently no-op when clicked faster than it loads.
  async function resolveOrgId(): Promise<string | null> {
    if (ws) return ws.orgId;
    const { data } = await supabase
      .from('org_members')
      .select('org_id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data?.org_id as string) ?? null;
  }

  async function clone() {
    if (!qstack) return;
    const orgId = await resolveOrgId();
    if (!orgId) {
      flash('Could not find your workspace; try again');
      return;
    }
    const { data, error } = await supabase.rpc('clone_qstack', {
      p_source: qstack.id,
      p_org: orgId,
    });
    if (!error && data) router.push(`/qstacks/${data}`);
    else flash(`Clone failed (${error?.message ?? 'unknown'})`);
  }

  async function setVisibility(v: 'private' | 'org' | 'public', alsoProfile: boolean) {
    if (!qstack) return;
    setVisibilityOpen(false);
    // Verify the write landed: an RLS refusal comes back as zero rows,
    // and a state change must never claim success it did not have.
    const { data, error } = await supabase
      .from('qstacks')
      .update({ visibility: v })
      .eq('id', qstack.id)
      .select('id, visibility');
    if (error || !data || data.length === 0) {
      flash(`Visibility unchanged (${error?.message ?? 'no permission to change this QStack'})`);
      return;
    }
    if (alsoProfile) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ visibility: 'public' }).eq('user_id', user.id);
      }
    }
    setQstack({ ...qstack, visibility: v });
    flash(v === 'public' ? 'Published to the marketplace' : `Visibility set to ${v}`);
  }

  if (notFound) {
    return (
      <div className="rounded-lg border border-line bg-white p-8 text-center">
        <h1 className="text-xl">This QStack is not available</h1>
        <p className="mt-2 text-ink-soft">
          It may be private to another workspace. Nothing of yours was lost.
        </p>
        <Link href="/library" className="mt-4 inline-block text-forest underline">
          Back to your library
        </Link>
      </div>
    );
  }
  if (!qstack) return <p className="text-ink-soft">Loading...</p>;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{qstack.title}</h1>
          <span className="ml-auto flex items-center gap-2">
            {savedFlash ? <span className="text-sm text-forest">{savedFlash}</span> : null}
            <button
              data-testid="qstack-visibility"
              onClick={() => setVisibilityOpen(true)}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:border-gold"
              aria-label={`Visibility: ${qstack.visibility}. Change`}
            >
              {qstack.visibility}
            </button>
            <button
              data-testid="clone-qstack"
              onClick={() => void clone()}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:border-gold"
            >
              Clone
            </button>
          </span>
        </div>

        {qstack.forked_from_id ? (
          <p data-testid="fork-lineage" className="mt-1 text-sm text-ink-soft">
            Forked from{' '}
            <Link href={`/qstacks/${qstack.forked_from_id}`} className="text-forest underline">
              {sourceTitle}
            </Link>
          </p>
        ) : null}

        <div className="mt-2 flex gap-2 text-xs text-ink-soft">
          {[qstack.role_family, qstack.level, qstack.methodology].filter(Boolean).map((m) => (
            <span key={m} className="rounded-full bg-cream px-2 py-0.5">
              {m.replace(/_/g, ' ')}
            </span>
          ))}
          <span aria-label={`${qstack.star_count} stars`}>
            <span className="text-gold">&#9733;</span> {qstack.star_count}
          </span>
        </div>

        {visibilityOpen ? (
          <div
            data-testid={qstack.visibility !== 'public' ? 'go-public-prompt' : undefined}
            role="dialog"
            aria-label="Change visibility"
            className="mt-4 rounded-lg border border-gold bg-white p-4 shadow-lift"
          >
            {qstack.visibility !== 'public' ? (
              <>
                <h2 className="text-lg">Publish this QStack?</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Public QStacks appear in the marketplace where anyone can
                  view, star, and clone them. Publishing also makes your
                  profile public so people can follow your releases; you can
                  change either at any time.
                </p>
              </>
            ) : (
              <h2 className="text-lg">Change visibility</h2>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {qstack.visibility !== 'public' ? (
                <button
                  onClick={() => void setVisibility('public', true)}
                  className="rounded-lg bg-gold px-3 py-1.5 text-sm font-medium hover:bg-gold-hover"
                >
                  Publish it, profile too
                </button>
              ) : null}
              <button
                onClick={() => void setVisibility('org', false)}
                className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-gold"
              >
                Share with my org
              </button>
              <button
                onClick={() => void setVisibility('private', false)}
                className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-gold"
              >
                Keep private
              </button>
              <button
                onClick={() => setVisibilityOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ol className="mt-6 flex flex-col gap-3">
              {items.map((item, idx) => (
                <QuestionRow
                  key={item.id}
                  item={item}
                  index={idx}
                  canEdit={canEdit}
                  onRemove={() => void removeItem(item.id)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>

        {items.length === 0 ? (
          <p className="mt-6 rounded-lg border border-line bg-white p-4 text-sm text-ink-soft">
            No questions yet. Add them from the screened bank on the right, or
            contribute your own below.
          </p>
        ) : null}

        {canEdit ? (
          <ContributeQuestion
            qstackId={qstack.id}
            defaultFamily={qstack.role_family}
            defaultLevel={qstack.level}
            open={addOpen}
            setOpen={setAddOpen}
            nextPosition={Math.max(0, ...items.map((i) => i.position)) + 1}
            onDone={async () => {
              await load();
              flash('Question saved');
            }}
          />
        ) : null}
      </div>

      <aside className="lg:border-l lg:border-line lg:pl-8">
        <h2 className="mb-3 text-lg">Add from the bank</h2>
        <BankPanel
          defaultFamily={qstack.role_family}
          defaultLevel={qstack.level}
          onAdd={canEdit ? addFromBank : undefined}
          addedQuestionIds={new Set(items.map((i) => i.question_id))}
        />
      </aside>
    </div>
  );
}

function QuestionRow({
  item,
  index,
  canEdit,
  onRemove,
}: {
  item: Item;
  index: number;
  canEdit: boolean;
  onRemove: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
  });
  const q = item.question;
  const flagged = q.screening_status === 'flagged';
  const pending = q.screening_status === 'pending';

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="qstack-question-row"
      aria-label={q.text.slice(0, 60)}
      className="rounded-lg border border-line bg-white p-4 shadow-card"
    >
      <div className="flex items-start gap-3">
        {canEdit ? (
          <button
            data-testid="reorder-handle"
            {...listeners}
            {...attributes}
            aria-label={`Reorder question ${index + 1}: ${q.text.slice(0, 40)}`}
            className="mt-0.5 cursor-grab touch-none rounded px-1 text-ink-soft hover:bg-cream"
          >
            &#8942;&#8942;
          </button>
        ) : null}
        <div className="flex-1">
          <p className="font-medium">
            <span className="mr-2 text-ink-soft">{index + 1}.</span>
            {q.text}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            {flagged ? (
              <span
                data-testid="screening-badge"
                className="rounded-full bg-flag-soft px-2 py-0.5 font-medium text-flag"
              >
                Flagged
              </span>
            ) : pending ? (
              <span
                data-testid="screening-badge"
                className="rounded-full bg-cream px-2 py-0.5 font-medium text-ink-soft"
              >
                Screening...
              </span>
            ) : (
              <span
                data-testid="screening-badge"
                className="rounded-full bg-forest-soft px-2 py-0.5 font-medium text-forest"
              >
                Screened
              </span>
            )}
            <span className="rounded-full bg-cream px-2 py-0.5 text-ink-soft">{q.category}</span>
            <button
              data-testid="question-detail-toggle"
              onClick={() => setDetailOpen((v) => !v)}
              aria-expanded={detailOpen}
              className="text-forest underline"
            >
              {detailOpen ? 'Hide detail' : 'Why this question'}
            </button>
            {canEdit ? (
              <button
                onClick={onRemove}
                aria-label={`Remove question: ${q.text.slice(0, 40)}`}
                className="ml-auto text-ink-soft hover:text-flag"
              >
                Remove
              </button>
            ) : null}
          </div>
          {flagged && q.flag_reason ? (
            <p className="mt-2 rounded-md bg-flag-soft p-2 text-xs text-flag">
              Flagged: {q.flag_reason}. Only you can see this question; it
              never surfaces in retrieval, interviews, or public views.
            </p>
          ) : null}
          {detailOpen ? (
            <div className="mt-2 rounded-md bg-cream p-3 text-sm text-ink-soft">
              <p>{q.rationale || 'No rationale recorded for this question yet.'}</p>
              <p className="mt-2 text-xs">
                Source:{' '}
                {(q.provenance?.source as string) === 'argo_seed_bank_v1'
                  ? 'Argo seed bank, drafted under Argo editorial direction, screened by claude-haiku-4-5'
                  : q.contributed_by
                    ? 'Contributed by a community member'
                    : 'Unknown provenance'}
              </p>
            </div>
          ) : null}
          {item.rubric?.anchors ? (
            <details className="mt-2 text-xs text-ink-soft">
              <summary className="cursor-pointer">Rubric anchors</summary>
              <ul className="mt-1 flex flex-col gap-0.5">
                {Object.entries(item.rubric.anchors).map(([value, anchor]) => (
                  <li key={value}>
                    <span className="font-semibold">{value}:</span> {anchor}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {item.followups?.length ? (
            <p className="mt-1 text-xs text-ink-soft">
              Follow-ups: {item.followups.join(' / ')}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function ContributeQuestion({
  qstackId,
  defaultFamily,
  defaultLevel,
  open,
  setOpen,
  nextPosition,
  onDone,
}: {
  qstackId: string;
  defaultFamily: string;
  defaultLevel: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  nextPosition: number;
  onDone: () => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('skill');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  async function save() {
    setBusy(true);
    setResult('');
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        category,
        roleFamily: defaultFamily || 'engineering',
        level: defaultLevel || 'mid',
      }),
    });
    const data = (await res.json()) as {
      id?: string;
      screening_status?: string;
      flag_reason?: string | null;
      error?: string;
    };
    if (!res.ok || !data.id) {
      setResult(`Could not save it (${data.error ?? res.status}). Your text is still here.`);
      setBusy(false);
      return;
    }
    const supabase = supabaseBrowser();
    await supabase.from('qstack_items').insert({
      qstack_id: qstackId,
      question_id: data.id,
      position: nextPosition,
      rubric: { anchors: DEFAULT_ANCHORS },
      followups: [],
    });
    setResult(
      data.screening_status === 'passed'
        ? 'Screened and added to your stack.'
        : `Saved to your stack, but flagged by screening: ${data.flag_reason ?? 'see the row for the reason'}. Only you can see it.`,
    );
    setText('');
    setBusy(false);
    await onDone();
  }

  if (!open) {
    return (
      <button
        data-testid="add-question"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-lg border border-dashed border-line bg-white px-4 py-2 text-sm text-ink-soft hover:border-gold"
      >
        Write your own question
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-line bg-white p-4 shadow-card">
      <h3 className="text-sm font-semibold">Contribute a question</h3>
      <p className="mt-1 text-xs text-ink-soft">
        Every contribution runs through compliance screening before it can
        surface anywhere. Accepted questions carry your name.
      </p>
      <textarea
        data-testid="question-text-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
        placeholder="Tell me about a time..."
      />
      <div className="mt-2 flex items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
          className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
        >
          {['motivation', 'culture', 'role', 'skill'].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          data-testid="question-save"
          onClick={() => void save()}
          disabled={busy || text.trim().length < 10}
          className="rounded-lg bg-gold px-3 py-1.5 text-sm font-medium hover:bg-gold-hover disabled:opacity-60"
        >
          {busy ? 'Screening...' : 'Screen and add'}
        </button>
        <button onClick={() => setOpen(false)} className="text-sm text-ink-soft hover:text-ink">
          Close
        </button>
      </div>
      {result ? <p className="mt-2 text-xs text-ink-soft">{result}</p> : null}
    </div>
  );
}
