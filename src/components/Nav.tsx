'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

interface NotificationRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

function notificationTarget(n: NotificationRow): { href: string; label: string } {
  const p = n.payload;
  switch (n.type) {
    case 'mention':
      return {
        href: `/live/${p.session_id}?response=${p.response_id}`,
        label: `${p.author_name || 'A teammate'} mentioned you on a response`,
      };
    case 'qstack_published':
      return {
        href: `/qstacks/${p.qstack_id}`,
        label: `New QStack published: ${p.title}`,
      };
    case 'contribution_accepted':
      return {
        href: '/bank',
        label: `Your question was accepted into the bank: "${p.question_text}"`,
      };
    default:
      return { href: '/library', label: n.type };
  }
}

function Bell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setItems((data as NotificationRow[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = items.filter((n) => !n.read_at).length;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      const supabase = supabaseBrowser();
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null)
        .eq('user_id', userId);
      void load();
    }
  }

  return (
    <div className="relative">
      <button
        data-testid="notifications-button"
        onClick={toggle}
        aria-label={`Notifications, ${unread} unread`}
        className="relative rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:border-gold"
      >
        Notifications
        {unread > 0 ? (
          <span className="absolute -right-2 -top-2 rounded-full bg-gold px-1.5 text-xs font-bold text-ink">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="absolute right-0 z-30 mt-2 w-96 rounded-lg border border-line bg-white p-2 shadow-lift"
        >
          {items.length === 0 ? (
            <p className="p-3 text-sm text-ink-soft">
              Nothing yet. Mentions, new QStacks from people you follow, and
              contribution credits land here.
            </p>
          ) : (
            items.map((n) => {
              const t = notificationTarget(n);
              return (
                <Link
                  key={n.id}
                  data-testid="notification-item"
                  href={t.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-md px-3 py-2 text-sm hover:bg-cream ${n.read_at ? 'text-ink-soft' : 'font-medium'}`}
                >
                  {t.label}
                </Link>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function Nav() {
  const [userId, setUserId] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = supabaseBrowser();
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUserId(user?.id ?? null);
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('handle')
          .eq('user_id', user.id)
          .maybeSingle();
        setHandle(data?.handle ?? null);
      }
    });
  }, []);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push('/signin');
  }

  return (
    <header className="border-b border-line bg-white">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link href={userId ? '/library' : '/'} className="font-display text-xl font-bold">
          Argo<span className="text-gold">.</span>
        </Link>
        {userId ? (
          <>
            <Link href="/library" className="text-sm hover:text-gold-hover">
              Library
            </Link>
            <Link href="/bank" className="text-sm hover:text-gold-hover">
              Question bank
            </Link>
            <Link href="/interviews" className="text-sm hover:text-gold-hover">
              Interviews
            </Link>
          </>
        ) : null}
        <Link href="/market" className="text-sm hover:text-gold-hover">
          Marketplace
        </Link>
        <div className="ml-auto flex items-center gap-3">
          {userId ? (
            <>
              <Bell userId={userId} />
              <Link
                href="/me"
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:border-gold"
              >
                {handle ? `@${handle}` : 'Profile'}
              </Link>
              <button onClick={signOut} className="text-sm text-ink-soft hover:text-ink">
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/signin"
              className="rounded-lg bg-gold px-3 py-1.5 text-sm font-medium hover:bg-gold-hover"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
