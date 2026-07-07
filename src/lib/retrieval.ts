import pg from 'pg';
import { callModel } from './registry.js';

// Question retrieval (PRD 4.3, 5.3): structured filters plus Postgres
// full-text search produce candidates; Claude Sonnet orders and
// annotates them. Retrieval-based by construction: the model returns
// ids from the candidate set only, never question text of its own.

export interface RetrievalQuery {
  roleFamily?: string;
  level?: string;
  category?: string;
  search?: string;
  limit?: number;
}

export interface RetrievedQuestion {
  id: string;
  text: string;
  category: string;
  role_family: string;
  level: string;
  rationale: string;
  verification: string | null;
  fitReason?: string;
}

// Candidates come exclusively from screening_status 'passed' (PRD 5.3
// hard rule 1); flagged and pending never surface here.
export async function retrieveQuestions(
  pool: pg.Pool,
  q: RetrievalQuery,
): Promise<RetrievedQuestion[]> {
  const result = await pool.query(
    `select id, text, category, role_family, level, rationale, verification
     from questions
     where screening_status = 'passed'
       and ($1::text is null or role_family = $1)
       and ($2::text is null or level = $2)
       and ($3::text is null or category = $3)
       and ($4::text is null or fts @@ websearch_to_tsquery('english', $4))
     order by
       case when $4::text is not null
            then ts_rank(fts, websearch_to_tsquery('english', $4)) end desc nulls last,
       created_at
     limit $5`,
    [q.roleFamily ?? null, q.level ?? null, q.category ?? null, q.search ?? null, q.limit ?? 20],
  );
  return result.rows as RetrievedQuestion[];
}

interface RerankItem {
  id: string;
  reason: string;
}

function parseRerank(text: string): RerankItem[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) {
    throw new Error(`re-ranker returned no JSON array: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed)) throw new Error('re-ranker output is not an array');
  return parsed
    .filter(
      (item): item is RerankItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as RerankItem).id === 'string' &&
        typeof (item as RerankItem).reason === 'string',
    )
    .map((item) => ({ id: item.id, reason: item.reason.trim() }));
}

const RERANK_SYSTEM = `You are re-ranking interview questions for an interviewer. You receive the interviewer's context and a numbered candidate list of questions, each with an id.

Order the candidates from best fit to worst fit for the stated context, and give each a one-line reason why it fits (or where it applies). Rules:
1. Return ONLY a JSON array, no markdown fences, no commentary.
2. Each element: {"id": "<id copied exactly from the candidate list>", "reason": "<one line, under 140 characters>"}.
3. Use only ids that appear in the candidate list. Never invent ids or question text.
4. Include every candidate exactly once.`;

// Sonnet re-rank of up to 20 candidates (PRD 4.3). Output ids are
// validated against the input set; anything else is discarded and
// logged (PRD 5.3 hard rule 2, decision D7).
export async function rerankQuestions(
  pool: pg.Pool,
  candidates: RetrievedQuestion[],
  context: string,
): Promise<RetrievedQuestion[]> {
  if (candidates.length === 0) return [];
  const pool20 = candidates.slice(0, 20);
  const byId = new Map(pool20.map((c) => [c.id, c]));

  const listing = pool20
    .map(
      (c, i) =>
        `${i + 1}. id=${c.id} [${c.category}/${c.level}] ${c.text}` +
        (c.rationale ? ` (screens for: ${c.rationale.slice(0, 140)})` : ''),
    )
    .join('\n');
  const prompt = `Interviewer context: ${context}\n\nCandidates:\n${listing}`;

  let items: RerankItem[];
  try {
    const res = await callModel(pool, 'retrieval_rerank', {
      system: RERANK_SYSTEM,
      prompt,
      maxTokens: 2500,
    });
    items = parseRerank(res.text);
  } catch {
    const retry = await callModel(pool, 'retrieval_rerank', {
      system: RERANK_SYSTEM,
      prompt: `${prompt}\n\nReminder: respond with ONLY the JSON array of {"id", "reason"} objects, ids copied exactly from the list.`,
      maxTokens: 2500,
    });
    items = parseRerank(retry.text);
  }

  const seen = new Set<string>();
  const ranked: RetrievedQuestion[] = [];
  for (const item of items) {
    const candidate = byId.get(item.id);
    if (!candidate) {
      console.warn(`rerank: discarded id not in candidate set: ${item.id}`);
      continue;
    }
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    ranked.push({ ...candidate, fitReason: item.reason || 'Fits the stated context.' });
  }
  return ranked;
}
