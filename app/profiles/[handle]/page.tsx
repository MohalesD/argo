'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Nav from '@/components/Nav';
import QStackCard, { type QStackRow } from '@/components/library/QStackCard';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useWorkspace } from '@/lib/useWorkspace';

interface ProfileRow {
  user_id: string;
  handle: string;
  display_name: string;
  bio: string;
  visibility: string;
}

interface PostRow {
  id: string;
  body: string;
  created_at: string;
}

// Public creator profile (PRD 5.9): posts, public QStacks, follow.
// Private profiles are unreachable by URL guessing; RLS returns nothing
// and this page shows a no-leak empty state.
export default function ProfilePage() {
  const params = useParams<{ handle: string }>();
  const ws = useWorkspace();
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [qstacks, setQstacks] = useState<QStackRow[]>([]);
  const [following, setFollowing] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const { data: p } = await supabase
      .from('profiles')
      .select('user_id, handle, display_name, bio, visibility')
      .eq('handle', params.handle)
      .maybeSingle();
    if (!p) {
      setMissing(true);
      return;
    }
    setProfile(p as ProfileRow);
    const { data: postRows } = await supabase
      .from('posts')
      .select('id, body, created_at')
      .eq('author_id', p.user_id)
      .order('created_at', { ascending: false })
      .limit(30);
    setPosts((postRows as PostRow[]) ?? []);
    const { data: stacks } = await supabase
      .from('qstacks')
      .select('*')
      .eq('owner_id', p.user_id)
      .eq('visibility', 'public')
      .order('star_count', { ascending: false });
    setQstacks((stacks as QStackRow[]) ?? []);
    if (ws) {
      const { data: f } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', ws.userId)
        .eq('followee_id', p.user_id)
        .maybeSingle();
      setFollowing(!!f);
    }
  }, [params.handle, supabase, ws]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (!ws) {
      router.push('/signin');
      return;
    }
    if (!profile) return;
    if (following) {
      setFollowing(false);
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', ws.userId)
        .eq('followee_id', profile.user_id);
    } else {
      setFollowing(true);
      await supabase
        .from('follows')
        .insert({ follower_id: ws.userId, followee_id: profile.user_id });
    }
  }

  if (missing) {
    return (
      <div className="min-h-screen">
        <Nav />
        <main className="mx-auto mt-16 max-w-md rounded-xl border border-line bg-white p-8 text-center shadow-card">
          <h1 className="font-display text-xl">Nothing to see here</h1>
          <p className="mt-2 text-ink-soft">
            This profile does not exist or is private. Profiles on Argo stay
            private until their owner chooses otherwise.
          </p>
        </main>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="min-h-screen">
        <Nav />
        <p className="p-10 text-center text-ink-soft">Loading profile...</p>
      </div>
    );
  }

  const isSelf = ws?.userId === profile.user_id;

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-soft font-display text-2xl">
            {(profile.display_name || profile.handle).slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl">{profile.display_name || profile.handle}</h1>
            <p className="text-sm text-ink-soft">@{profile.handle}</p>
          </div>
          {!isSelf ? (
            <button
              data-testid="follow-button"
              onClick={() => void toggleFollow()}
              aria-pressed={following}
              className={`ml-auto rounded-lg px-4 py-2 font-medium ${
                following
                  ? 'border border-line bg-white hover:border-gold'
                  : 'bg-gold hover:bg-gold-hover'
              }`}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          ) : (
            <Link
              href="/me"
              className="ml-auto rounded-lg border border-line bg-white px-4 py-2 hover:border-gold"
            >
              Edit profile
            </Link>
          )}
        </div>
        {profile.bio ? <p className="mt-3 max-w-xl text-ink-soft">{profile.bio}</p> : null}

        {qstacks.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display text-xl text-forest">Public QStacks</h2>
            <div className="mt-3 flex flex-col gap-3">
              {qstacks.map((q) => (
                <QStackCard key={q.id} qstack={q} variant="row" />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="font-display text-xl text-forest">Notes from the field</h2>
          {posts.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">No posts yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {posts.map((post) => (
                <li
                  key={post.id}
                  data-testid="post-item"
                  className="rounded-lg border border-line bg-white p-3 text-sm shadow-card"
                >
                  <p>{post.body}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {new Date(post.created_at).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
