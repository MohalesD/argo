import { NextResponse, type NextRequest } from 'next/server';
import { retrieveQuestions, rerankQuestions } from '@/lib/retrieval';
import { serverPool } from '@/lib/server/pool';
import { supabaseServer } from '@/lib/supabase/server';

// Retrieval re-rank (PRD 4.3): filters + FTS produce candidates from
// the passed-only bank, Sonnet orders and annotates them. Signed-in
// users only; the model call is logged to ai_calls by the registry.
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'sign in required' }, { status: 401 });
  }

  const body = (await request.json()) as {
    roleFamily?: string;
    level?: string;
    category?: string;
    search?: string;
    context?: string;
  };

  const pool = serverPool();
  const candidates = await retrieveQuestions(pool, {
    roleFamily: body.roleFamily,
    level: body.level,
    category: body.category,
    search: body.search,
    limit: 20,
  });

  const context =
    body.context?.trim() ||
    [
      'Interviewer preparing a screen',
      body.roleFamily ? `for a ${body.roleFamily.replace(/_/g, ' ')} role` : '',
      body.level ? `at ${body.level} level` : '',
      body.category ? `focused on ${body.category} fit` : '',
      body.search ? `with emphasis on: ${body.search}` : '',
    ]
      .filter(Boolean)
      .join(' ');

  const results = await rerankQuestions(pool, candidates, context);
  return NextResponse.json({ results });
}
