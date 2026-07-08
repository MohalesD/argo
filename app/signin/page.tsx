'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

function SignInContent() {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'rate-limited' | 'error'>(
    'idle',
  );
  const [errorText, setErrorText] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'link') {
      setErrorText('The sign-in link was invalid or expired.');
      setState('error');
    }
  }, [searchParams]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: { first_name: firstName },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/library`,
      },
    });
    if (!error) {
      setState('sent');
    } else if (error.code === 'over_email_send_rate_limit') {
      setState('rate-limited');
    } else {
      setErrorText(error.message);
      setState('error');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-4xl text-ink">Argo</h1>
      <p className="mt-2 text-ink-soft">
        The interview layer. Sign in or create your account with just a first
        name and an email.
      </p>

      {state === 'sent' || state === 'rate-limited' ? (
        <div
          data-testid={state === 'sent' ? 'signin-sent' : 'signin-rate-limited'}
          className="mt-8 rounded-lg border border-line bg-white p-6 shadow-card"
        >
          <h2 className="text-xl">
            {state === 'sent' ? 'Check your email' : 'One moment'}
          </h2>
          <p className="mt-2 text-ink-soft">
            {state === 'sent'
              ? `A sign-in link is on its way to ${email}. Open it on this device to land in your workspace.`
              : 'Our mailer just hit its hourly sending limit, so no link went out yet. Nothing is wrong with your address; try again in a little while.'}
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">First name</span>
            <input
              data-testid="signin-first-name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2"
              autoComplete="given-name"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Email</span>
            <input
              data-testid="signin-email"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2"
              autoComplete="email"
            />
          </label>
          <button
            data-testid="signin-submit"
            type="submit"
            disabled={state === 'sending'}
            className="mt-2 rounded-lg bg-gold px-4 py-2.5 font-medium text-ink transition-colors hover:bg-gold-hover disabled:opacity-60"
          >
            {state === 'sending' ? 'Sending your link...' : 'Send me a sign-in link'}
          </button>
          {state === 'error' ? (
            <p className="text-sm text-flag">
              The link could not be sent ({errorText}). Check the address and
              try again; nothing was lost.
            </p>
          ) : null}
        </form>
      )}
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}
