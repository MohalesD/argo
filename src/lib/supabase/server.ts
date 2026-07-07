import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server client: reads the user session from cookies in server
// components and route handlers. Writes are attempted and ignored in
// contexts where Next forbids cookie mutation (middleware handles
// refresh).
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all) => {
          try {
            for (const { name, value, options } of all) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server components cannot set cookies; middleware refreshes.
          }
        },
      },
    },
  );
}
