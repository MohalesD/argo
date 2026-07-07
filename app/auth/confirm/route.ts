import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Magic-link verification. Handles both link shapes: token_hash (the
// admin-minted and token-hash email templates) and code (PKCE
// redirects from the default template). On first login, bootstraps the
// personal org (PRD 5.1) and a private profile (PRD 5.9, D12).

async function bootstrap(supabase: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: membership } = await supabase
    .from('org_members')
    .select('id')
    .limit(1)
    .maybeSingle();
  const firstName =
    (user.user_metadata?.first_name as string | undefined)?.trim() || 'My';
  if (!membership) {
    await supabase.rpc('create_org', { p_name: `${firstName}'s Workspace` });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) {
    const slug = firstName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'crew';
    const handle = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
    await supabase.from('profiles').insert({
      user_id: user.id,
      handle,
      display_name: firstName,
    });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/library';
  const supabase = await supabaseServer();

  let ok = false;
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type: 'email', token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(new URL('/signin?error=link', request.url));
  }

  await bootstrap(supabase);
  return NextResponse.redirect(new URL(next.startsWith('/') ? next : '/library', request.url));
}
