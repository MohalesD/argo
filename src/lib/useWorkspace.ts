'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from './supabase/client';

export interface Workspace {
  userId: string;
  orgId: string;
  firstName: string;
}

// The signed-in user's workspace context (personal org from bootstrap,
// or their first org membership). Client-side surfaces key their
// org-scoped reads and writes off this.
export function useWorkspace(): Workspace | null {
  const [ws, setWs] = useState<Workspace | null>(null);
  useEffect(() => {
    const supabase = supabaseBrowser();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!membership) return;
      setWs({
        userId: user.id,
        orgId: membership.org_id as string,
        firstName: (user.user_metadata?.first_name as string | undefined) ?? '',
      });
    })();
  }, []);
  return ws;
}
