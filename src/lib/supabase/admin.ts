import { createClient } from '@supabase/supabase-js';

// Service-role client, server-only. Bypasses RLS: used exclusively for
// the operations RLS deliberately excludes (auth admin in tests, invite
// acceptance bookkeeping). Never import from client components.
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not set');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
