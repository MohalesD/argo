'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export interface BankQuestion {
  id: string;
  text: string;
  category: string;
  role_family: string;
  level: string;
  rationale: string;
  verification: string | null;
  contributed_by: string | null;
  fitReason?: string;
}

const FAMILIES = [
  'engineering', 'product_management', 'sales', 'customer_success', 'people_ops',
  'data_analytics', 'marketing', 'finance', 'operations', 'design',
];
const LEVELS = ['junior', 'mid', 'senior', 'lead'];
const CATEGORIES = ['motivation', 'culture', 'role', 'skill'];

// The question bank surface (PRD 5.3): structured filters plus
// full-text search, with Sonnet re-rank on demand. Reused embedded in
// the QStack editor (adds go straight into that stack, Locality-First)
// and standalone on /bank.
export default function BankPanel({
  defaultFamily = '',
  defaultLevel = '',
  onAdd,
  addedQuestionIds,
}: {
  defaultFamily?: string;
  defaultLevel?: string;
  onAdd?: (q: BankQuestion) => Promise<void> | void;
  addedQuestionIds?: Set<string>;
}) {
  const [family, setFamily] = useState(defaultFamily);
  const [level, setLevel] = useState(defaultLevel);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<BankQuestion[]>([]);
  const [reranked, setReranked] = useState(false);
  const [busy, setBusy] = useState<'search' | 'rerank' | null>(null);
  const [error, setError] = useState('');

  const runSearch = useCallback(async () => {
    setBusy('search');
    setError('');
    setReranked(false);
    const supabase = supabaseBrowser();
    let query = supabase
      .from('questions')
      .select('id, text, category, role_family, level, rationale, verification, contributed_by')
      .eq('screening_status', 'passed')
      .limit(20);
    if (family) query = query.eq('role_family', family);
    if (level) query = query.eq('level', level);
    if (category) query = query.eq('category', category);
    if (search.trim()) query = query.textSearch('fts', search.trim(), { type: 'websearch' });
    const { data, error: err } = await query;
    if (err) setError(err.message);
    setResults((data as BankQuestion[]) ?? []);
    setBusy(null);
  }, [family, level, category, search]);

  useEffect(() => {
    void runSearch();
    // Initial load: a browsable default set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function rerank() {
    setBusy('rerank');
    setError('');
    try {
      const res = await fetch('/api/rerank', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          roleFamily: family || undefined,
          level: level || undefined,
          category: category || undefined,
          search: search.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`re-rank failed (${res.status})`);
      const data = (await res.json()) as { results: BankQuestion[] };
      setResults(data.results);
      setReranked(true);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(null);
  }

  return (
    <section aria-label="Question bank" className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-ink-soft">Search the bank</span>
          <input
            data-testid="bank-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="stakeholders, pipeline, onboarding..."
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
          />
        </label>
        <select
          data-testid="bank-filter-family"
          aria-label="Role family"
          value={family}
          onChange={(e) => setFamily(e.target.value)}
          className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
        >
          <option value="">All families</option>
          {FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select
          data-testid="bank-filter-level"
          aria-label="Level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
        >
          <option value="">All levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          data-testid="bank-filter-category"
          aria-label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          data-testid="bank-search-submit"
          type="submit"
          disabled={busy !== null}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium hover:border-gold disabled:opacity-60"
        >
          {busy === 'search' ? 'Searching...' : 'Search'}
        </button>
        <button
          data-testid="rerank-button"
          type="button"
          onClick={() => void rerank()}
          disabled={busy !== null || results.length === 0}
          className="rounded-lg bg-forest px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy === 'rerank' ? 'Ranking for fit...' : 'Rank by fit'}
        </button>
      </form>

      {error ? (
        <p className="text-sm text-flag">
          The bank search hit a problem ({error}). Your filters are kept; try
          again.
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {results.map((q) => (
          <li
            key={q.id}
            data-testid="bank-result"
            aria-label={q.text.slice(0, 60)}
            className="rounded-lg border border-line bg-white p-3 shadow-card"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm">{q.text}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  <span
                    data-testid="screening-badge"
                    className="rounded-full bg-forest-soft px-2 py-0.5 font-medium text-forest"
                  >
                    Screened
                  </span>
                  <span className="rounded-full bg-cream px-2 py-0.5">{q.category}</span>
                  <span className="rounded-full bg-cream px-2 py-0.5">
                    {q.role_family.replace(/_/g, ' ')} / {q.level}
                  </span>
                </div>
                {reranked && q.fitReason ? (
                  <p data-testid="rerank-reason" className="mt-1.5 text-xs italic text-forest">
                    {q.fitReason}
                  </p>
                ) : null}
              </div>
              {onAdd ? (
                <button
                  data-testid="bank-add-to-qstack"
                  onClick={() => void onAdd(q)}
                  disabled={addedQuestionIds?.has(q.id)}
                  aria-label={`Add to QStack: ${q.text.slice(0, 40)}`}
                  className="shrink-0 rounded-lg bg-gold px-3 py-1.5 text-sm font-medium hover:bg-gold-hover disabled:opacity-50"
                >
                  {addedQuestionIds?.has(q.id) ? 'Added' : 'Add'}
                </button>
              ) : null}
            </div>
          </li>
        ))}
        {results.length === 0 && busy === null ? (
          <li className="rounded-lg border border-line bg-white p-4 text-sm text-ink-soft">
            No screened questions match these filters. Widen a filter or clear
            the search to browse the bank.
          </li>
        ) : null}
      </ul>
    </section>
  );
}
