'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useWorkspace } from '@/lib/useWorkspace';

interface ProfileRow {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  visibility: 'private' | 'public';
}

interface PostRow {
  id: string;
  body: string;
  created_at: string;
}

// Own profile and posts (PRD 5.9): default private with an explicit
// visibility toggle (D12), 280-character posts enforced by the schema
// and mirrored in the composer.
export default function MePage() {
  const ws = useWorkspace();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [postBody, setPostBody] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    if (!ws) return;
    const { data: p } = await supabase
      .from('profiles')
      .select('id, handle, display_name, bio, visibility')
      .eq('user_id', ws.userId)
      .maybeSingle();
    if (p) {
      setProfile(p as ProfileRow);
      setDisplayName(p.display_name as string);
      setBio(p.bio as string);
    }
    const { data: postRows } = await supabase
      .from('posts')
      .select('id, body, created_at')
      .eq('author_id', ws.userId)
      .order('created_at', { ascending: false });
    setPosts((postRows as PostRow[]) ?? []);
  }, [ws, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  function note(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2000);
  }

  async function saveProfile() {
    if (!profile) return;
    await supabase
      .from('profiles')
      .update({ display_name: displayName, bio })
      .eq('id', profile.id);
    note('Profile saved');
  }

  async function toggleVisibility() {
    if (!profile) return;
    const next = profile.visibility === 'public' ? 'private' : 'public';
    await supabase.from('profiles').update({ visibility: next }).eq('id', profile.id);
    setProfile({ ...profile, visibility: next });
    note(next === 'public' ? 'Your profile is now public' : 'Your profile is private again');
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!ws || !postBody.trim()) return;
    const { error } = await supabase
      .from('posts')
      .insert({ author_id: ws.userId, body: postBody.trim() });
    if (!error) {
      setPostBody('');
      note('Posted');
      await load();
    }
  }

  if (!profile) return <p className="text-ink-soft">Loading your profile...</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl">Your profile</h1>
        {flash ? <span className="text-sm text-forest">{flash}</span> : null}
        {profile.visibility === 'public' ? (
          <Link href={`/profiles/${profile.handle}`} className="ml-auto text-sm text-forest underline">
            View public page
          </Link>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-white p-5 shadow-card">
        <div className="flex items-center gap-3">
          <p className="text-sm text-ink-soft">@{profile.handle}</p>
          <button
            data-testid="profile-visibility-toggle"
            onClick={() => void toggleVisibility()}
            aria-pressed={profile.visibility === 'public'}
            className={`ml-auto rounded-lg border px-3 py-1.5 text-sm ${
              profile.visibility === 'public'
                ? 'border-forest bg-forest-soft text-forest'
                : 'border-line hover:border-gold'
            }`}
          >
            {profile.visibility === 'public' ? 'Public' : 'Private'}
          </button>
        </div>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-sm font-medium">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded-lg border border-line px-3 py-2"
          />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-sm font-medium">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            className="rounded-lg border border-line px-3 py-2"
          />
        </label>
        <button
          onClick={() => void saveProfile()}
          className="mt-3 rounded-lg bg-gold px-4 py-2 text-sm font-medium hover:bg-gold-hover"
        >
          Save profile
        </button>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl text-forest">Notes from the field</h2>
        <p className="mt-1 text-sm text-ink-soft">
          What you learned interviewing this week, in 280 characters. Posts
          show on your public profile.
        </p>
        <form onSubmit={publish} className="mt-3 rounded-xl border border-line bg-white p-4 shadow-card">
          <textarea
            data-testid="post-input"
            value={postBody}
            onChange={(e) => setPostBody(e.target.value.slice(0, 280))}
            rows={3}
            placeholder="Today I learned..."
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <div className="mt-2 flex items-center">
            <span className={`text-xs ${postBody.length >= 280 ? 'text-flag' : 'text-ink-soft'}`}>
              {postBody.length}/280
            </span>
            <button
              data-testid="post-submit"
              type="submit"
              disabled={!postBody.trim()}
              className="ml-auto rounded-lg bg-gold px-4 py-1.5 text-sm font-medium hover:bg-gold-hover disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </form>
        <ul className="mt-4 flex flex-col gap-2">
          {posts.map((post) => (
            <li
              key={post.id}
              data-testid="post-item"
              className="rounded-lg border border-line bg-white p-3 text-sm shadow-card"
            >
              <p>{post.body}</p>
              <p className="mt-1 text-xs text-ink-soft">
                {new Date(post.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
