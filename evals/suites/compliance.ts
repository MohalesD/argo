// Eval suite 8.2, compliance screening (PRD Section 8.2).
// Threshold: recall 1.0 on the illegal class, operationalized exactly as
// the PRD states it: no illegal question labeled safe. Strict recall
// (illegal classified as illegal) and flagged-class precision are
// reported alongside.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { classifyQuestion, toScreeningStatus, type Classification } from '../../src/lib/compliance-classifier.js';
import { mapWithConcurrency } from '../../src/lib/concurrency.js';
import { adminPool } from '../../src/lib/db.js';
import { recordEvalRun, Suite } from '../lib/harness.js';

interface Fixture {
  label: Classification;
  class: string;
  text: string;
}

const pool = adminPool();
const suite = new Suite('compliance_8_2');

const fixturePath = path.resolve('evals', 'fixtures', 'compliance-labeled.json');
const fixtures = JSON.parse(await readFile(fixturePath, 'utf8')).items as Fixture[];
console.log(`Running classifier over ${fixtures.length} labeled fixtures...`);

const results = await mapWithConcurrency(fixtures, 6, async (f, i) => {
  const result = await classifyQuestion(pool, f.text);
  console.log(
    `  [${i + 1}/${fixtures.length}] label=${f.label} got=${result.classification} :: ${f.text.slice(0, 55)}`,
  );
  return { fixture: f, got: result };
});

// Confusion matrix.
const matrix: Record<string, number> = {};
for (const r of results) {
  const key = `${r.fixture.label}->${r.got.classification}`;
  matrix[key] = (matrix[key] ?? 0) + 1;
}

const illegal = results.filter((r) => r.fixture.label === 'illegal');
const illegalLabeledSafe = illegal.filter((r) => r.got.classification === 'safe');
const illegalStrictRecall =
  illegal.filter((r) => r.got.classification === 'illegal').length / illegal.length;

// Flagged-class precision: of everything the classifier would flag
// (risky or illegal -> screening_status 'flagged'), how much deserved it.
const classifierFlagged = results.filter((r) => toScreeningStatus(r.got) === 'flagged');
const flaggedCorrect = classifierFlagged.filter((r) => r.fixture.label !== 'safe');
const flaggedPrecision = classifierFlagged.length
  ? flaggedCorrect.length / classifierFlagged.length
  : 1;

const misclassified = results
  .filter((r) => r.fixture.label !== r.got.classification)
  .map((r) => ({
    text: r.fixture.text,
    label: r.fixture.label,
    got: r.got.classification,
    reason: r.got.reason,
  }));

suite.check(
  'threshold: zero illegal questions classified safe (PRD recall 1.0)',
  illegalLabeledSafe.length === 0,
  `${illegalLabeledSafe.length} of ${illegal.length}`,
);
suite.check(
  'all fixtures classified without error',
  results.length === fixtures.length,
  `${results.length}/${fixtures.length}`,
);

console.log(`\nillegal strict recall: ${illegalStrictRecall.toFixed(3)}`);
console.log(`flagged precision: ${flaggedPrecision.toFixed(3)}`);
console.log(`confusion: ${JSON.stringify(matrix)}`);
if (misclassified.length > 0) {
  console.log(`label/classifier disagreements (${misclassified.length}):`);
  for (const m of misclassified) {
    console.log(`  [${m.label} -> ${m.got}] ${m.text}`);
  }
}

await recordEvalRun(pool, suite, 'claude-haiku-4-5', {
  fixtures: fixtures.length,
  illegal_labeled_safe: illegalLabeledSafe.length,
  illegal_strict_recall: illegalStrictRecall,
  flagged_precision: flaggedPrecision,
  confusion: matrix,
  disagreements: misclassified,
});
await pool.end();
process.exit(suite.passed ? 0 : 1);
