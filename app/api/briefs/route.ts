import { NextResponse, type NextRequest } from 'next/server';
import { generateBrief, type BriefResponseInput } from '@/lib/brief';
import { serverPool } from '@/lib/server/pool';
import { supabaseServer } from '@/lib/supabase/server';

// Brief generation (PRD 5.7). Reads the session's captured responses
// under the caller's RLS, drafts with Sonnet through the grounding
// pipeline, and stores the draft brief. The caller only ever gets a
// brief for a session their org can see.
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'sign in required' }, { status: 401 });
  }

  const { sessionId } = (await request.json()) as { sessionId?: string };
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const { data: session } = await supabase
    .from('interview_sessions')
    .select('id, interview_id, state')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  const { data: interview } = await supabase
    .from('interviews')
    .select('id, candidate_name, role, qstack:qstacks(title, role_family, level)')
    .eq('id', session.interview_id)
    .maybeSingle();
  if (!interview) {
    return NextResponse.json({ error: 'interview not found' }, { status: 404 });
  }

  const { data: responses } = await supabase
    .from('responses')
    .select('id, question_id, response_text, starred, question:questions(text)')
    .eq('session_id', sessionId);
  const captured = (responses ?? []).filter(
    (r) => (r.response_text as string).trim().length > 0,
  );
  if (captured.length === 0) {
    return NextResponse.json(
      { error: 'no captured responses; a brief needs at least one' },
      { status: 400 },
    );
  }

  const { data: scores } = await supabase
    .from('scores')
    .select('response_id, value, anchor, supersedes_score_id, id, created_at')
    .in('response_id', captured.map((r) => r.id as string));
  const superseded = new Set((scores ?? []).map((s) => s.supersedes_score_id).filter(Boolean));
  const currentByResponse = new Map<string, { value: number; anchor: string }>();
  for (const s of (scores ?? []).sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at)),
  )) {
    if (!superseded.has(s.id)) {
      currentByResponse.set(s.response_id as string, {
        value: s.value as number,
        anchor: s.anchor as string,
      });
    }
  }

  const qstack = interview.qstack as unknown as { title: string; role_family: string; level: string } | null;
  const roleText =
    (interview.role as string) ||
    [qstack?.role_family?.replace(/_/g, ' '), qstack?.level, qstack?.title]
      .filter(Boolean)
      .join(', ');

  const briefInput: BriefResponseInput[] = captured.map((r) => ({
    id: r.id as string,
    questionText: ((r.question as unknown as { text: string } | null)?.text ?? '').toString(),
    responseText: r.response_text as string,
    starred: r.starred as boolean,
    scoreValue: currentByResponse.get(r.id as string)?.value,
    scoreAnchor: currentByResponse.get(r.id as string)?.anchor,
  }));

  try {
    const { content, model } = await generateBrief(serverPool(), {
      candidateName: interview.candidate_name as string,
      role: roleText,
      responses: briefInput,
    });

    const { data: brief, error } = await supabase
      .from('briefs')
      .insert({
        interview_id: interview.id,
        content,
        generated_by_model: model,
        status: 'draft',
      })
      .select('id')
      .single();
    if (error || !brief) {
      return NextResponse.json({ error: error?.message ?? 'brief insert failed' }, { status: 400 });
    }
    return NextResponse.json({ briefId: brief.id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
