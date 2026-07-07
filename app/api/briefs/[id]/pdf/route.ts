import { NextResponse, type NextRequest } from 'next/server';
import type { BriefContent, BriefResponseInput } from '@/lib/brief';
import { renderBriefPdf } from '@/lib/pdf';
import { supabaseServer } from '@/lib/supabase/server';

// Server-side PDF export (PRD 5.7): the same brief content as the web
// view, rendered under the caller's RLS. No access, no PDF.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'sign in required' }, { status: 401 });
  }

  const { data: brief } = await supabase
    .from('briefs')
    .select('id, content, generated_by_model, interview_id')
    .eq('id', id)
    .maybeSingle();
  if (!brief) {
    return NextResponse.json({ error: 'brief not found' }, { status: 404 });
  }

  const { data: interview } = await supabase
    .from('interviews')
    .select('candidate_name, role')
    .eq('id', brief.interview_id)
    .maybeSingle();

  const { data: sessions } = await supabase
    .from('interview_sessions')
    .select('id')
    .eq('interview_id', brief.interview_id);
  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  const { data: responses } = sessionIds.length
    ? await supabase
        .from('responses')
        .select('id, response_text, starred, question:questions(text)')
        .in('session_id', sessionIds)
    : { data: [] };

  const responseInputs: BriefResponseInput[] = (responses ?? []).map((r) => ({
    id: r.id as string,
    questionText: ((r.question as unknown as { text: string } | null)?.text ?? '').toString(),
    responseText: r.response_text as string,
    starred: r.starred as boolean,
  }));

  const pdf = await renderBriefPdf({
    candidateName: (interview?.candidate_name as string) ?? 'Candidate',
    role: (interview?.role as string) ?? '',
    content: brief.content as BriefContent,
    responses: responseInputs,
    generatedByModel: (brief.generated_by_model as string) ?? null,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="argo-brief-${id}.pdf"`,
    },
  });
}
