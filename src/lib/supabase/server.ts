import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server client: reads the user session from cookies in server
// components and route handlers. Route handlers can set cookies;
// server components cannot (middleware handles refresh there).
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all) => {
          for (const { name, value, options } of all) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}
