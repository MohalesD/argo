import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Magic-link verification. Handles both link shapes: token_hash (the
// admin-minted and token-hash email templates) and code (PKCE
// redirects from the default template). On first login, bootstraps the
// personal org (PRD 5.1) and a private profile (PRD 5.9, D12).

async function bootstrap(supabase: SupabaseClient): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (!user) {
    console.error('[bootstrap] No user from getUser():', userError);
    return;
  }

  const { data: membership, error: memberError } = await supabase
    .from('org_members')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const firstName =
    (user.user_metadata?.first_name as string | undefined)?.trim() || 'My';

  if (!membership) {
    const { error: createError } = await supabase.rpc('create_org', {
      p_name: `${firstName}'s Workspace`,
    });
    if (createError) {
      console.error('[bootstrap] create_org failed:', createError);
      throw createError;
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) {
    const slug = firstName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'crew';
    const handle = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
    const { error: insertError } = await supabase.from('profiles').insert({
      user_id: user.id,
      handle,
      display_name: firstName,
    });
    if (insertError) {
      console.error('[bootstrap] profile insert failed:', insertError);
      throw insertError;
    }
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/library';
  const supabase = await supabaseServer();

  let ok = false;
  let verifyError: string | null = null;
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type: 'email', token_hash: tokenHash });
    ok = !error;
    verifyError = error?.message ?? null;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    verifyError = error?.message ?? null;
  }

  if (!ok) {
    console.error('[auth/confirm] verification failed:', verifyError);
    return NextResponse.redirect(new URL('/signin?error=link', request.url));
  }

  try {
    await bootstrap(supabase);
  } catch (e) {
    console.error('[auth/confirm] bootstrap failed:', e instanceof Error ? e.message : String(e));
  }

  const response = NextResponse.redirect(new URL(next.startsWith('/') ? next : '/library', request.url));

  // Explicitly copy all cookies from the cookie store to the response,
  // ensuring the session established by verifyOtp is sent to the browser.
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    response.cookies.set(cookie.name, cookie.value, cookie);
  }

  return response;
}
