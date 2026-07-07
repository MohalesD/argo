'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Nav from '@/components/Nav';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useWorkspace } from '@/lib/useWorkspace';

interface MarketQStack {
  id: string;
  title: string;
  role_family: string;
  level: string;
  methodology: string;
  star_count: number;
  owner_id: string;
  created_at: string;
}

interface Listing {
  qstack_id: string;
  price_cents: number;
  status: string;
}

interface ProfileLite {
  user_id: string;
  handle: string;
  display_name: string;
}

// Marketplace, interface only (PRD 5.10, D16): browse public QStacks by
// stars or recency; free ones clone for real; premium listings show a
// price badge and a Coming soon button that moves no money.
export default function MarketPage() {
  const ws = useWorkspace();
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [sort, setSort] = useState<'stars' | 'recent'>('stars');
  const [qstacks, setQstacks] = useState<MarketQStack[]>([]);
  const [listings, setListings] = useState<Map<string, Listing>>(new Map());
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [myStars, setMyStars] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('qstacks')
      .select('id, title, role_family, level, methodology, star_count, owner_id, created_at')
      .eq('visibility', 'public')
      .order(sort === 'stars' ? 'star_count' : 'created_at', { ascending: false })
      .limit(60);
    const rows = (data as MarketQStack[]) ?? [];
    setQstacks(rows);

    if (rows.length) {
      const { data: ls } = await supabase
        .from('marketplace_listings')
        .select('qstack_id, price_cents, status')
        .in('qstack_id', rows.map((r) => r.id));
      setListings(new Map(((ls as Listing[]) ?? []).map((l) => [l.qstack_id, l])));
      const { data: ps } = await supabase
        .from('profiles')
        .select('user_id, handle, display_name')
        .in('user_id', [...new Set(rows.map((r) => r.owner_id))]);
      setProfiles(new Map(((ps as ProfileLite[]) ?? []).map((p) => [p.user_id, p])));
    }
    if (ws) {
      const { data: stars } = await supabase.from('stars').select('qstack_id');
      setMyStars(new Set(((stars as { qstack_id: string }[]) ?? []).map((s) => s.qstack_id)));
    }
  }, [sort, supabase, ws]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStar(q: MarketQStack) {
    if (!ws) {
      router.push('/signin');
      return;
    }
    const starred = myStars.has(q.id);
    // Optimistic count change with immediate visible feedback.
    setQstacks((cur) =>
      cur.map((row) =>
        row.id === q.id ? { ...row, star_count: row.star_count + (starred ? -1 : 1) } : row,
      ),
    );
    setMyStars((cur) => {
      const next = new Set(cur);
      if (starred) next.delete(q.id);
      else next.add(q.id);
      return next;
    });
    if (starred) {
      await supabase.from('stars').delete().eq('user_id', ws.userId).eq('qstack_id', q.id);
    } else {
      const { error } = await supabase
        .from('stars')
        .insert({ user_id: ws.userId, qstack_id: q.id });
      if (error) {
        // Unique violation under concurrency: reconcile with the truth.
        await load();
      }
    }
  }

  async function getQStack(q: MarketQStack) {
    if (!ws) {
      router.push('/signin');
      return;
    }
    const { data, error } = await supabase.rpc('clone_qstack', {
      p_source: q.id,
      p_org: ws.orgId,
    });
    if (error || !data) {
      setNotice(`Could not clone (${error?.message ?? 'unknown'}). Nothing changed.`);
      return;
    }
    router.push(`/qstacks/${data}`);
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">Marketplace</h1>
          <p className="text-sm text-ink-soft">
            Public QStacks from the community. Clone what works; star what
            deserves finding.
          </p>
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-line bg-white p-1">
            <button
              data-testid="market-sort-stars"
              onClick={() => setSort('stars')}
              aria-pressed={sort === 'stars'}
              className={`rounded-md px-3 py-1 text-sm ${sort === 'stars' ? 'bg-gold font-medium' : 'hover:bg-cream'}`}
            >
              Most starred
            </button>
            <button
              data-testid="market-sort-recent"
              onClick={() => setSort('recent')}
              aria-pressed={sort === 'recent'}
              className={`rounded-md px-3 py-1 text-sm ${sort === 'recent' ? 'bg-gold font-medium' : 'hover:bg-cream'}`}
            >
              Newest
            </button>
          </div>
        </div>

        {notice ? <p className="mt-3 text-sm text-flag">{notice}</p> : null}

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {qstacks.map((q) => {
            const listing = listings.get(q.id);
            const premium = !!listing && listing.price_cents > 0;
            const profile = profiles.get(q.owner_id);
            return (
              <article
                key={q.id}
                data-testid="market-card"
                aria-label={q.title}
                className="flex flex-col rounded-xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-lift"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/qstacks/${q.id}`} className="font-display text-lg leading-snug hover:text-gold-hover">
                    {q.title}
                  </Link>
                  {premium ? (
                    <span
                      data-testid="price-badge"
                      className="shrink-0 rounded-full bg-forest px-2 py-0.5 text-xs font-medium text-white"
                    >
                      ${(listing.price_cents / 100).toFixed(2)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-ink-soft">
                  {[q.role_family, q.level, q.methodology].filter(Boolean).map((m) => (
                    <span key={m} className="rounded-full bg-cream px-2 py-0.5">
                      {m.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                {profile ? (
                  <Link
                    href={`/profiles/${profile.handle}`}
                    className="mt-2 text-xs text-forest underline"
                  >
                    by {profile.display_name || `@${profile.handle}`}
                  </Link>
                ) : null}
                <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
                  <button
                    data-testid="star-button"
                    onClick={() => void toggleStar(q)}
                    aria-pressed={myStars.has(q.id)}
                    aria-label={`Star ${q.title}`}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm ${
                      myStars.has(q.id)
                        ? 'border-gold bg-gold-soft'
                        : 'border-line hover:border-gold'
                    }`}
                  >
                    <span className="text-gold">&#9733;</span>
                    <span data-testid="star-count">{q.star_count}</span>
                  </button>
                  {premium ? (
                    <button
                      data-testid="get-button"
                      disabled
                      title="Premium QStacks are coming soon; no payment happens today."
                      className="ml-auto cursor-not-allowed rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft"
                    >
                      Coming soon
                    </button>
                  ) : (
                    <button
                      data-testid="get-button"
                      onClick={() => void getQStack(q)}
                      className="ml-auto rounded-lg bg-gold px-3 py-1.5 text-sm font-medium hover:bg-gold-hover"
                    >
                      Get
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {qstacks.length === 0 ? (
            <p className="col-span-full rounded-lg border border-line bg-white p-8 text-center text-ink-soft">
              Nothing public yet. Publish a QStack from your library and it
              appears here for the whole community.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
