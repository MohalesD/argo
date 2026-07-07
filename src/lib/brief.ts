import pg from 'pg';
import { mapWithConcurrency } from './concurrency.js';
import { callModel } from './registry.js';

// Candidate brief generation (PRD 5.7, 8.3). Sonnet drafts; every
// factual claim carries citations to captured response ids; an
// in-pipeline Haiku grounding gate drops any claim the cited text does
// not literally support, with one tighter-grounding regeneration when
// the first draft loses claims. Ungrounded claims do not survive.

export interface BriefResponseInput {
  id: string;
  questionText: string;
  responseText: string;
  starred: boolean;
  scoreValue?: number;
  scoreAnchor?: string;
}

export interface BriefClaim {
  text: string;
  citations: string[];
}

export interface BriefContent {
  role_context: string;
  sections: { category: string; claims: BriefClaim[] }[];
  starred_moments: BriefClaim[];
  open_questions: string[];
}

export interface BriefInput {
  candidateName: string;
  role: string;
  responses: BriefResponseInput[];
}

const DRAFT_SYSTEM = `You draft a candidate brief from captured interview responses. Each response is the interviewer's typed capture of what the candidate said, and it is the complete record: sometimes verbatim, sometimes shorthand notes. The brief structures what was captured; it never evaluates, recommends, or infers.

Output ONLY a JSON object, no markdown fences, no commentary:
{
  "role_context": "<2-3 sentences about the ROLE being hired for, not the candidate>",
  "sections": [{"category": "<theme>", "claims": [{"text": "<claim>", "citations": ["<response id>"]}]}],
  "starred_moments": [{"text": "<claim>", "citations": ["<response id>"]}],
  "open_questions": ["<question for the hiring team>"]
}

Hard rules for every claim in sections and starred_moments:
1. A claim states only what the cited response literally says. Never add numbers, team sizes, amounts, timeframes, outcomes, or names the response does not state.
2. Cite only ids from the provided response list. Every claim carries at least one citation.
3. When the candidate hedged ("I think", "probably", "not sure"), the claim must carry the hedge: write "says they believe..." or "was unsure whether...", never a confident restatement.
4. Attribute self-reports: prefer "describes...", "reports...", "says..." over asserting the fact as established.
5. If two responses contradict each other, do NOT reconcile them into one claim. Put the tension into open_questions and, if claimed at all, cite each side separately with its hedged attribution.
6. Every starred response deserves at least one starred_moments claim, subject to rules 1 through 5.
7. open_questions are questions for the hiring team (gaps, contradictions, things worth probing next round). They are not claims and carry no citations.
8. Group section claims under 2 to 4 sensible category themes for the role.`;

const GROUNDING_SYSTEM = `You are a strict grounding checker for one candidate-brief claim. You get the claim and the cited capture(s): the interviewer's typed record of the response. The capture IS the complete record; there is no fuller transcript behind it, so never reject a claim merely because the capture is brief or note-like. The claim survives only if the capture's content states or directly contains what the claim asserts, including any hedges. A reasonable inference, a generalization, an added number or detail, or a confident restatement of a hedged answer is NOT grounded; a claim that accurately mirrors the capture (including summary-style captures) IS grounded. When in doubt about content mismatch, answer false.

Respond with ONLY a JSON object: {"grounded": true | false, "why": "<one short sentence>"}`;

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error(`no JSON object in model output: ${text.slice(0, 200)}`);
  }
  return text.slice(start, end + 1);
}

function normalizeContent(raw: unknown): BriefContent {
  const c = raw as Partial<BriefContent>;
  const cleanClaims = (claims: unknown): BriefClaim[] =>
    Array.isArray(claims)
      ? claims
          .filter(
            (cl): cl is BriefClaim =>
              typeof cl === 'object' &&
              cl !== null &&
              typeof (cl as BriefClaim).text === 'string' &&
              Array.isArray((cl as BriefClaim).citations),
          )
          .map((cl) => ({
            text: cl.text.trim(),
            citations: cl.citations.filter((id): id is string => typeof id === 'string'),
          }))
      : [];
  return {
    role_context: typeof c.role_context === 'string' ? c.role_context : '',
    sections: Array.isArray(c.sections)
      ? c.sections
          .filter((s) => typeof s === 'object' && s !== null)
          .map((s) => ({
            category: typeof s.category === 'string' ? s.category : 'General',
            claims: cleanClaims(s.claims),
          }))
      : [],
    starred_moments: cleanClaims(c.starred_moments),
    open_questions: Array.isArray(c.open_questions)
      ? c.open_questions.filter((q): q is string => typeof q === 'string')
      : [],
  };
}

async function draft(pool: pg.Pool, input: BriefInput, extra: string): Promise<BriefContent> {
  const listing = input.responses
    .map(
      (r) =>
        `Response id=${r.id}${r.starred ? ' [STARRED]' : ''}${
          r.scoreValue ? ` [scored ${r.scoreValue}/4: ${r.scoreAnchor ?? ''}]` : ''
        }\nQ: ${r.questionText}\nA: ${r.responseText}`,
    )
    .join('\n\n');
  const res = await callModel(pool, 'brief_drafting', {
    system: DRAFT_SYSTEM,
    prompt:
      `Candidate: ${input.candidateName}\nRole: ${input.role}\n\nCaptured responses:\n${listing}` +
      (extra ? `\n\n${extra}` : ''),
    maxTokens: 3000,
  });
  return normalizeContent(JSON.parse(extractJson(res.text)));
}

interface GroundingVerdict {
  grounded: boolean;
  why: string;
}

async function checkGrounding(
  pool: pg.Pool,
  claim: BriefClaim,
  byId: Map<string, BriefResponseInput>,
): Promise<GroundingVerdict> {
  const cited = claim.citations.map((id) => byId.get(id)).filter((r): r is BriefResponseInput => !!r);
  if (cited.length === 0) return { grounded: false, why: 'no valid citations' };
  const citedText = cited
    .map((r) => `Response ${r.id} (Q: ${r.questionText})\n${r.responseText}`)
    .join('\n\n');
  const prompt = `Claim: ${claim.text}\n\nCited response(s):\n${citedText}`;
  const parse = (text: string): GroundingVerdict => {
    const parsed = JSON.parse(extractJson(text)) as Partial<GroundingVerdict>;
    if (typeof parsed.grounded !== 'boolean') throw new Error('invalid grounding verdict');
    return { grounded: parsed.grounded, why: parsed.why ?? '' };
  };
  try {
    const res = await callModel(pool, 'brief_grounding_check', {
      system: GROUNDING_SYSTEM,
      prompt,
      maxTokens: 200,
      temperature: 0,
    });
    return parse(res.text);
  } catch {
    const retry = await callModel(pool, 'brief_grounding_check', {
      system: GROUNDING_SYSTEM,
      prompt: `${prompt}\n\nReminder: respond with ONLY the JSON object {"grounded": ..., "why": ...}.`,
      maxTokens: 200,
      temperature: 0,
    });
    return parse(retry.text);
  }
}

// Validates one draft: structural citation integrity, then the
// grounding gate. Returns the surviving content plus what was dropped.
async function validateDraft(
  pool: pg.Pool,
  content: BriefContent,
  input: BriefInput,
): Promise<{ content: BriefContent; dropped: string[] }> {
  const byId = new Map(input.responses.map((r) => [r.id, r]));
  const dropped: string[] = [];

  const filterClaims = async (claims: BriefClaim[]): Promise<BriefClaim[]> => {
    const structural = claims
      .map((cl) => ({ ...cl, citations: cl.citations.filter((id) => byId.has(id)) }))
      .filter((cl) => {
        if (cl.citations.length === 0 || cl.text === '') {
          dropped.push(cl.text || '(empty claim)');
          console.warn(`brief grounding: dropped structurally (no valid citation): ${cl.text.slice(0, 120)}`);
          return false;
        }
        return true;
      });
    const verdicts = await mapWithConcurrency(structural, 6, (cl) => checkGrounding(pool, cl, byId));
    return structural.filter((cl, i) => {
      if (!verdicts[i]?.grounded) {
        dropped.push(cl.text);
        console.warn(
          `brief grounding: dropped (${verdicts[i]?.why ?? 'no verdict'}): ${cl.text.slice(0, 120)}`,
        );
        return false;
      }
      return true;
    });
  };

  const sections: BriefContent['sections'] = [];
  for (const section of content.sections) {
    const claims = await filterClaims(section.claims);
    if (claims.length > 0) sections.push({ category: section.category, claims });
  }
  const starred = await filterClaims(content.starred_moments);

  return {
    content: {
      role_context: content.role_context,
      sections,
      starred_moments: starred,
      open_questions: content.open_questions,
    },
    dropped,
  };
}

export async function generateBrief(
  pool: pg.Pool,
  input: BriefInput,
): Promise<{ content: BriefContent; model: 'claude-sonnet-4-6' }> {
  if (input.responses.length === 0) {
    throw new Error('cannot generate a brief from zero captured responses');
  }

  // The model sees short stable aliases (r1..rN) instead of raw UUIDs:
  // long ids get mangled in citation copying often enough to sink a
  // whole draft structurally. Aliases are mapped back to the real ids
  // before validation, so the stored content still cites real response
  // ids (PRD 5.7).
  const aliasById = new Map(input.responses.map((r, i) => [r.id, `r${i + 1}`]));
  const idByAlias = new Map(input.responses.map((r, i) => [`r${i + 1}`, r.id]));
  const aliasedInput: BriefInput = {
    ...input,
    responses: input.responses.map((r) => ({ ...r, id: aliasById.get(r.id)! })),
  };
  const unalias = (content: BriefContent): BriefContent => ({
    ...content,
    sections: content.sections.map((s) => ({
      ...s,
      claims: s.claims.map((c) => ({
        ...c,
        citations: c.citations.map((id) => idByAlias.get(id.trim()) ?? id),
      })),
    })),
    starred_moments: content.starred_moments.map((c) => ({
      ...c,
      citations: c.citations.map((id) => idByAlias.get(id.trim()) ?? id),
    })),
  });

  const first = await validateDraft(pool, unalias(await draft(pool, aliasedInput, '')), input);
  let final = first;

  // One tighter-grounding regeneration when the first draft lost claims
  // (PRD 8.3: a brief that fails regenerates with tighter grounding).
  if (first.dropped.length > 0) {
    const feedback =
      `A previous draft was rejected because these claims were not literally supported by their cited responses:\n` +
      first.dropped.map((d) => `- ${d}`).join('\n') +
      `\nRedraft. State ONLY what the cited responses literally say; carry every hedge; move anything uncertain into open_questions instead of claiming it.`;
    const second = await validateDraft(
      pool,
      unalias(await draft(pool, aliasedInput, feedback)),
      input,
    );
    final = second;
  }

  const claimCount =
    final.content.sections.reduce((n, s) => n + s.claims.length, 0) +
    final.content.starred_moments.length;
  if (claimCount === 0) {
    // Persistent failure blocks the finalize action upstream; a brief
    // with zero grounded claims never silently ships.
    throw new Error('brief generation failed: no claim survived the grounding gate');
  }

  return { content: final.content, model: 'claude-sonnet-4-6' };
}
