'use client';

import { createBrowserClient } from '@supabase/ssr';

// Browser client: user-scoped CRUD under RLS. One instance per tab.
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
