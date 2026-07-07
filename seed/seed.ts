// Seed bank ingestion (PRD 5.4, Goal 1). Every question runs through the
// compliance classifier before receiving any status: safe -> passed with
// verification 'screened'; risky or illegal -> flagged with the reason,
// author-visible only. Nothing is inserted pre-passed.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { classifyQuestion, toScreeningStatus } from '../src/lib/compliance-classifier.js';
import { mapWithConcurrency } from '../src/lib/concurrency.js';
import { adminPool } from '../src/lib/db.js';

interface SeedQuestion {
  text: string;
  category: 'motivation' | 'culture' | 'role' | 'skill';
  level: 'junior' | 'mid' | 'senior' | 'lead';
  rationale: string;
}

interface SeedFile {
  role_family: string;
  questions: SeedQuestion[];
}

const SOURCE = 'argo_seed_bank_v1';
const pool = adminPool();

// Resumable: already-seeded question texts are skipped unless --force
// wipes and starts over.
if (process.argv.includes('--force')) {
  const wiped = await pool.query(
    "delete from questions where provenance ->> 'source' = $1",
    [SOURCE],
  );
  console.log(`--force: removed ${wiped.rowCount} previously seeded questions`);
}
const alreadySeeded = new Set<string>(
  (
    await pool.query("select text from questions where provenance ->> 'source' = $1", [SOURCE])
  ).rows.map((r: { text: string }) => r.text),
);
if (alreadySeeded.size > 0) {
  console.log(`resuming: ${alreadySeeded.size} questions already seeded, skipping those`);
}

const questionsDir = path.resolve('seed', 'questions');
const files = (await readdir(questionsDir)).filter((f) => f.endsWith('.json')).sort();
const batches: Array<{ family: string; q: SeedQuestion }> = [];
for (const file of files) {
  const parsed = JSON.parse(await readFile(path.join(questionsDir, file), 'utf8')) as SeedFile;
  for (const q of parsed.questions) {
    batches.push({ family: parsed.role_family, q });
  }
}
const plants = JSON.parse(
  await readFile(path.resolve('seed', 'known-flagged.json'), 'utf8'),
) as SeedFile;
for (const q of plants.questions) {
  batches.push({ family: plants.role_family, q });
}

const pending = batches.filter((b) => !alreadySeeded.has(b.q.text));
console.log(
  `Screening ${pending.length} of ${batches.length} questions through the compliance classifier...`,
);

// Honest provenance (PRD 5.4, D14): drafted for the launch bank, passed
// through the automated compliance screen. 'Screened', never 'Verified'.
const provenance = {
  source: SOURCE,
  author: 'Argo editorial launch bank',
  drafting: 'Drafted with Claude Fable 5 under Argo editorial direction, July 2026',
  screening: 'Automated compliance screen, claude-haiku-4-5',
};

let done = 0;
const failures: Array<{ text: string; error: string }> = [];
const results = await mapWithConcurrency(pending, 6, async (item) => {
  try {
    const verdict = await classifyQuestion(pool, item.q.text);
    const status = toScreeningStatus(verdict);
    await pool.query(
      `insert into questions
         (text, category, role_family, level, rationale, provenance,
          screening_status, flag_reason, verification)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        item.q.text,
        item.q.category,
        item.family,
        item.q.level,
        item.q.rationale,
        JSON.stringify(provenance),
        status,
        status === 'flagged' ? `${verdict.classification}: ${verdict.reason}` : null,
        status === 'passed' ? 'screened' : null,
      ],
    );
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${pending.length} screened`);
    return {
      family: item.family,
      text: item.q.text,
      status,
      classification: verdict.classification,
    };
  } catch (err) {
    failures.push({ text: item.q.text, error: (err as Error).message.slice(0, 160) });
    return null;
  }
});

const summary = await pool.query(
  `select role_family, screening_status, count(*)::int as n
   from questions where provenance ->> 'source' = $1
   group by role_family, screening_status order by role_family, screening_status`,
  [SOURCE],
);
console.log('\nSeed bank summary (family / status / count):');
for (const row of summary.rows) {
  console.log(`  ${row.role_family}  ${row.screening_status}  ${row.n}`);
}

const flagged = results.filter((r) => r !== null && r.status === 'flagged');
console.log(`\nflagged this run (${flagged.length}):`);
for (const f of flagged) {
  if (f) console.log(`  [${f.classification}] ${f.text.slice(0, 80)}`);
}

if (failures.length > 0) {
  console.log(`\nFAILURES (${failures.length}), rerun seed to retry these:`);
  for (const f of failures) {
    console.log(`  ${f.text.slice(0, 70)} :: ${f.error}`);
  }
}

const totals = await pool.query(
  `select screening_status, count(*)::int as n from questions
   where provenance ->> 'source' = $1 group by screening_status`,
  [SOURCE],
);
console.log(`\ntotals: ${totals.rows.map((r) => `${r.screening_status}=${r.n}`).join(', ')}`);
await pool.end();
process.exit(failures.length > 0 ? 1 : 0);
