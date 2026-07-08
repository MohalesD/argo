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
        error: userError,
      } = await supabase.auth.getUser();
      if (!user) {
        console.debug('[useWorkspace] No user from getUser():', userError);
        return;
      }
      const { data: membership, error: memberError } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (memberError) {
        console.debug('[useWorkspace] org_members error:', memberError);
        return;
      }
      if (!membership) {
        console.debug('[useWorkspace] No membership found for user', user.id);
        return;
      }
      setWs({
        userId: user.id,
        orgId: membership.org_id as string,
        firstName: (user.user_metadata?.first_name as string | undefined) ?? '',
      });
    })();
  }, []);
  return ws;
}
