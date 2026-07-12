'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import KanbanBoard from '@/components/library/KanbanBoard';
import QStackCard, { type QStackRow } from '@/components/library/QStackCard';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useWorkspace } from '@/lib/useWorkspace';

type ViewMode = 'list' | 'stack' | 'board';

// The QStack library (PRD 5.2): list view and stack view over the same
// data, plus Kanban organization. Same actions in the same relative
// positions across views (Locality-First rule 11).
export default function LibraryPage() {
  const ws = useWorkspace();
  const [view, setView] = useState<ViewMode>('list');
  const [qstacks, setQstacks] = useState<QStackRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!ws) return;
    const supabase = supabaseBrowser();
    const { data } = await supabase
      .from('qstacks')
      .select('*')
      .eq('org_id', ws.orgId)
      .order('created_at', { ascending: false });
    setQstacks((data as QStackRow[]) ?? []);
    setLoaded(true);
  }, [ws]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggles: { mode: ViewMode; label: string; testid: string }[] = [
    { mode: 'list', label: 'List', testid: 'view-toggle-list' },
    { mode: 'stack', label: 'Stacks', testid: 'view-toggle-stack' },
    { mode: 'board', label: 'Board', testid: 'view-toggle-board' },
  ];

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-3xl">Your QStacks</h1>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-line bg-white p-1">
          {toggles.map((t) => (
            <button
              key={t.mode}
              data-testid={t.testid}
              onClick={() => setView(t.mode)}
              aria-pressed={view === t.mode}
              className={`rounded-md px-3 py-1 text-sm ${view === t.mode ? 'bg-gold font-medium' : 'hover:bg-cream'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Link
          data-testid="new-qstack"
          href="/qstacks/new"
          className="rounded-lg bg-gold px-4 py-2 font-medium hover:bg-gold-hover"
        >
          New QStack
        </Link>
      </div>

      {loaded && qstacks.length === 0 ? (
        <div className="mt-12 rounded-lg border border-line bg-white p-8 text-center shadow-card">
          <h2 className="text-xl">Your library starts here</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-soft">
            A QStack is your ordered set of interview questions with rubrics
            and follow-ups. Build one from the screened bank, or clone one
            from the marketplace.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/qstacks/new"
              className="rounded-lg bg-gold px-4 py-2 font-medium hover:bg-gold-hover"
            >
              Build your first QStack
            </Link>
            <Link
              href="/market"
              className="rounded-lg border border-line bg-white px-4 py-2 hover:border-gold"
            >
              Browse the marketplace
            </Link>
          </div>
        </div>
      ) : null}

      {view === 'list' ? (
        <div className="mt-6 flex flex-col gap-3">
          {qstacks.map((q) => (
            <QStackCard key={q.id} qstack={q} variant="row" />
          ))}
        </div>
      ) : null}

      {view === 'stack' ? (
        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {qstacks.map((q) => (
            <QStackCard key={q.id} qstack={q} variant="stack" />
          ))}
        </div>
      ) : null}

      {view === 'board' && ws ? (
        <KanbanBoard orgId={ws.orgId} qstacks={qstacks} />
      ) : null}
    </div>
  );
}
