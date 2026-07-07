// Eval suite 8.1, retrieval quality (PRD Section 8.1 and 5.3).
// PRD threshold, quoted exactly: "precision at 5 of at least 0.6, and
// zero flagged questions in any result." This suite operationalizes
// "precision at 5" as the mean P@5 across the 25 fixtures in
// evals/fixtures/retrieval-fixtures.json; per-fixture P@5 is recorded
// alongside in eval_runs so a single weak fixture is visible, not
// averaged away silently.
//
// Two hard rules from 5.3 are checked structurally, not just trusted:
// flagged and pending questions must never appear in retrieveQuestions
// candidates or in rerankQuestions output, the re-ranker must return
// only ids drawn from the candidate set it was given, and every
// re-ranked result must carry a non-empty fitReason.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  retrieveQuestions,
  rerankQuestions,
  type RetrievedQuestion,
} from '../../src/lib/retrieval.js';
import { adminPool } from '../../src/lib/db.js';
import { recordEvalRun, Suite } from '../lib/harness.js';

interface FixtureQuery {
  roleFamily?: string;
  level?: string;
  category?: string;
  search?: string;
}

interface Fixture {
  name: string;
  query: FixtureQuery;
  context: string;
  relevant: string[];
}

interface FixtureResult {
  name: string;
  candidates: number;
  reranked: number;
  hits: number;
  p5: number;
}

const pool = adminPool();
const suite = new Suite('retrieval_8_1');

const fixturePath = path.resolve('evals', 'fixtures', 'retrieval-fixtures.json');
const fixtures = JSON.parse(await readFile(fixturePath, 'utf8')).fixtures as Fixture[];
console.log(`Running retrieval quality suite over ${fixtures.length} fixtures...`);

const perFixture: FixtureResult[] = [];
const flaggedViolations: string[] = [];
const pendingViolations: string[] = [];
const idIntegrityViolations: string[] = [];
const missingFitReason: string[] = [];
const unresolvedRelevant: string[] = [];

async function screeningStatuses(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await pool.query('select id, screening_status from questions where id = any($1::uuid[])', [
    ids,
  ]);
  return new Map(rows.rows.map((r) => [r.id as string, r.screening_status as string]));
}

for (const [i, fx] of fixtures.entries()) {
  // Ids differ per environment; resolve the fixture's relevant question
  // texts to this database's ids at run time.
  const resolved = await pool.query('select id, text from questions where text = any($1::text[])', [
    fx.relevant,
  ]);
  const relevantIds = new Set<string>(resolved.rows.map((r) => r.id as string));
  if (relevantIds.size !== fx.relevant.length) {
    const missing = fx.relevant.filter((t) => !resolved.rows.some((r) => r.text === t));
    unresolvedRelevant.push(`${fx.name}: ${missing.length} unresolved (${missing.slice(0, 2).join(' | ')})`);
  }

  const candidates: RetrievedQuestion[] = await retrieveQuestions(pool, { ...fx.query, limit: 20 });
  const candidateIds = new Set(candidates.map((c) => c.id));

  const candidateStatus = await screeningStatuses(candidates.map((c) => c.id));
  for (const [id, status] of candidateStatus) {
    if (status === 'flagged') flaggedViolations.push(`${fx.name}: candidate ${id}`);
    if (status === 'pending') pendingViolations.push(`${fx.name}: candidate ${id}`);
  }

  const reranked: RetrievedQuestion[] = await rerankQuestions(pool, candidates, fx.context);
  const top5 = reranked.slice(0, 5);

  const rerankedStatus = await screeningStatuses(top5.map((r) => r.id));
  for (const [id, status] of rerankedStatus) {
    if (status === 'flagged') flaggedViolations.push(`${fx.name}: reranked ${id}`);
    if (status === 'pending') pendingViolations.push(`${fx.name}: reranked ${id}`);
  }

  for (const r of top5) {
    if (!candidateIds.has(r.id)) idIntegrityViolations.push(`${fx.name}: ${r.id} not in candidate set`);
    if (!r.fitReason || r.fitReason.trim() === '') missingFitReason.push(`${fx.name}: ${r.id}`);
  }

  const hits = top5.filter((r) => relevantIds.has(r.id)).length;
  const p5 = hits / 5;
  perFixture.push({ name: fx.name, candidates: candidates.length, reranked: top5.length, hits, p5 });
  console.log(
    `  [${i + 1}/${fixtures.length}] ${fx.name}: candidates=${candidates.length} top5=${top5.length} hits=${hits} P@5=${p5.toFixed(2)}`,
  );
}

const meanP5 = perFixture.reduce((sum, f) => sum + f.p5, 0) / perFixture.length;

suite.check(
  'mean P@5 across fixtures >= 0.6 (PRD 8.1 threshold, operationalized as the mean)',
  meanP5 >= 0.6,
  `mean=${meanP5.toFixed(3)}`,
);
suite.check(
  'zero flagged questions in any result at any stage',
  flaggedViolations.length === 0,
  `${flaggedViolations.length} violations`,
);
suite.check(
  'zero pending questions in any result at any stage',
  pendingViolations.length === 0,
  `${pendingViolations.length} violations`,
);
suite.check(
  'every re-ranked result id was in the candidate set',
  idIntegrityViolations.length === 0,
  `${idIntegrityViolations.length} violations`,
);
suite.check(
  'every re-ranked result carries a non-empty fitReason',
  missingFitReason.length === 0,
  `${missingFitReason.length} violations`,
);
suite.check(
  'all fixture relevant texts resolved to ids in this bank',
  unresolvedRelevant.length === 0,
  `${unresolvedRelevant.length} fixtures with unresolved text`,
);

console.log(`\nmean P@5: ${meanP5.toFixed(3)}`);
if (flaggedViolations.length) console.log('flagged violations:', flaggedViolations);
if (pendingViolations.length) console.log('pending violations:', pendingViolations);
if (idIntegrityViolations.length) console.log('id integrity violations:', idIntegrityViolations);
if (missingFitReason.length) console.log('missing fitReason violations:', missingFitReason);
if (unresolvedRelevant.length) console.log('unresolved relevant texts:', unresolvedRelevant);

await recordEvalRun(pool, suite, 'claude-sonnet-4-6', {
  meanP5,
  perFixture,
  flaggedViolations,
  pendingViolations,
  idIntegrityViolations,
  missingFitReason,
});
await pool.end();
process.exit(suite.passed ? 0 : 1);
