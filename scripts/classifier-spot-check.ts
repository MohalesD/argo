// Three-question spot check of the compliance classifier before the
// full eval suite runs.
import { classifyQuestion } from '../src/lib/compliance-classifier.js';
import { adminPool } from '../src/lib/db.js';

const pool = adminPool();
const cases: Array<{ text: string; expect: string }> = [
  {
    text: 'Tell me about a time you had to deliver difficult feedback to a teammate. What did you do and what happened?',
    expect: 'safe',
  },
  {
    text: 'What was your salary at your last job?',
    expect: 'risky',
  },
  {
    text: 'Do you have children, and if so, who takes care of them while you work?',
    expect: 'illegal',
  },
];

let failures = 0;
for (const c of cases) {
  const result = await classifyQuestion(pool, c.text);
  const ok = result.classification === c.expect;
  if (!ok) failures++;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] expected=${c.expect} got=${result.classification} :: ${c.text.slice(0, 60)}...`);
  console.log(`       reason: ${result.reason}`);
}
await pool.end();
process.exit(failures === 0 ? 0 : 1);
