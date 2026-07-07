import { NextResponse, type NextRequest } from 'next/server';
import { classifyQuestion, toScreeningStatus } from '@/lib/compliance-classifier';
import { serverPool } from '@/lib/server/pool';
import { supabaseServer } from '@/lib/supabase/server';

// Contributed questions (PRD 5.3, 5.4): the user inserts as pending
// under RLS (they cannot set their own screening status), then the
// service-side classifier screens it on Haiku and promotes or flags.
// Only 'safe' earns 'passed' (D-G1-7); the contribution-credit
// notification fires from the 0009 trigger on promotion.
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'sign in required' }, { status: 401 });
  }

  const body = (await request.json()) as {
    text?: string;
    category?: string;
    roleFamily?: string;
    level?: string;
    rationale?: string;
  };
  const text = body.text?.trim();
  if (!text || !body.category || !body.roleFamily || !body.level) {
    return NextResponse.json(
      { error: 'text, category, roleFamily, and level are required' },
      { status: 400 },
    );
  }

  // 1. Insert as the user, pending, under RLS.
  const { data: inserted, error: insertError } = await supabase
    .from('questions')
    .insert({
      text,
      category: body.category,
      role_family: body.roleFamily,
      level: body.level,
      rationale: body.rationale ?? '',
      provenance: { source: 'user_contribution' },
      screening_status: 'pending',
      contributed_by: user.id,
    })
    .select('id')
    .single();
  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? 'insert failed' }, { status: 400 });
  }

  // 2. Screen service-side (Haiku via the registry, logged to ai_calls).
  const pool = serverPool();
  const result = await classifyQuestion(pool, text);
  const status = toScreeningStatus(result);
  await pool.query(
    `update questions
     set screening_status = $1,
         flag_reason = $2,
         verification = $3
     where id = $4`,
    [
      status,
      status === 'flagged' ? result.reason : null,
      status === 'passed' ? 'screened' : null,
      inserted.id,
    ],
  );

  return NextResponse.json({
    id: inserted.id,
    screening_status: status,
    flag_reason: status === 'flagged' ? result.reason : null,
  });
}
