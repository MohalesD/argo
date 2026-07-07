// Eval suite 8.3, brief faithfulness (PRD Section 5.7, 8.3).
// Threshold: zero unsupported claims across all 15 synthetic transcripts;
// every factual sentence in a generated brief cites a response ID that
// exists and supports it. role_context describes the role, not the
// candidate, so it carries no citations and is not checked here.
// open_questions are questions, not factual claims, so they are not
// support-checked; the PRD does not set a threshold on them, so their
// presence on contradiction transcripts is a report-only metric.
//
// The judge call (purpose 'brief_faithfulness_judge', routed to
// claude-haiku-4-5 in src/lib/models.ts) is an eval-harness call on an
// allowlisted production model. It goes through the same registry as
// every other call and is logged to ai_calls exactly like a production
// call would be; it is not itself a production surface.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { generateBrief } from '../../src/lib/brief.js';
import type { BriefClaim, BriefResponseInput } from '../../src/lib/brief.js';
import { mapWithConcurrency } from '../../src/lib/concurrency.js';
import { adminPool } from '../../src/lib/db.js';
import { callModel } from '../../src/lib/registry.js';
import { recordEvalRun, Suite } from '../lib/harness.js';

interface FixtureTranscript {
  name: string;
  candidateName: string;
  role: string;
  traits: string[];
  responses: BriefResponseInput[];
}

interface ClaimRecord {
  transcriptName: string;
  section: string;
  text: string;
  citations: string[];
  structurallyOk: boolean;
}

interface JudgedClaim extends ClaimRecord {
  supported: boolean;
  reason: string;
}

const JUDGE_SYSTEM_PROMPT = `You are a strict fact checker for an interview candidate brief. You will be given a single claim from a brief and the full text of the interview response(s) it cites. Decide whether the cited response(s) actually state or directly support the claim, judged only on what was actually said.

Do not give credit for a claim that is a reasonable inference, a generalization, or a plausible guess if the cited text does not state it. A claim about a fact the response never mentions, for example a specific number, team size, dollar amount, or outcome that was never stated, is NOT supported, even if the response is broadly on the same topic.

Respond with ONLY a JSON object, no markdown fences, no commentary:
{"supported": true | false, "reason": "<one sentence>"}`;

function parseJudgeOutput(text: string): { supported: boolean; reason: string } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`judge returned no JSON object: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(match[0]) as Partial<{ supported: boolean; reason: string }>;
  if (typeof parsed.supported !== 'boolean') {
    throw new Error(`judge returned invalid supported field: ${String(parsed.supported)}`);
  }
  return { supported: parsed.supported, reason: typeof parsed.reason === 'string' ? parsed.reason : '' };
}

async function judgeClaim(
  pool: import('pg').Pool,
  claimText: string,
  citedResponses: BriefResponseInput[],
): Promise<{ supported: boolean; reason: string }> {
  const citedText = citedResponses
    .map((r) => `Response ${r.id} (Q: ${r.questionText})\n${r.responseText}`)
    .join('\n\n');
  const prompt = `Claim: ${claimText}\n\nCited response(s):\n${citedText}`;
  const response = await callModel(pool, 'brief_faithfulness_judge', {
    system: JUDGE_SYSTEM_PROMPT,
    prompt,
    maxTokens: 200,
  });
  try {
    return parseJudgeOutput(response.text);
  } catch {
    // One strict retry, same idiom as compliance-classifier.ts: an
    // occasional response comments instead of returning the JSON object.
    const retry = await callModel(pool, 'brief_faithfulness_judge', {
      system: JUDGE_SYSTEM_PROMPT,
      prompt: `${prompt}\n\nReminder: respond with ONLY the JSON object {"supported": ..., "reason": ...}.`,
      maxTokens: 200,
    });
    return parseJudgeOutput(retry.text);
  }
}

const pool = adminPool();
const suite = new Suite('brief_faithfulness_8_3');

const fixturePath = path.resolve('evals', 'fixtures', 'brief-transcripts.json');
const fixtureData = JSON.parse(await readFile(fixturePath, 'utf8')) as {
  description: string;
  transcripts: FixtureTranscript[];
};
const transcripts = fixtureData.transcripts;
console.log(`Generating briefs for ${transcripts.length} synthetic transcripts...`);

// generateBrief's input contract is { candidateName, role, responses };
// traits is suite-only metadata and is stripped before the call.
const generations = await mapWithConcurrency(transcripts, 6, async (t, i) => {
  const result = await generateBrief(pool, {
    candidateName: t.candidateName,
    role: t.role,
    responses: t.responses,
  });
  console.log(`  [${i + 1}/${transcripts.length}] generated brief for ${t.name} (${t.candidateName})`);
  return { transcript: t, result };
});

suite.check(
  'all 15 transcripts generated a brief without error',
  generations.length === transcripts.length,
  `${generations.length}/${transcripts.length}`,
);

// Check 1: structural integrity. Every claim in sections and
// starred_moments must have at least one citation, and every citation id
// must exist in that transcript's own response ids.
const allClaims: ClaimRecord[] = [];

for (const { transcript, result } of generations) {
  const responseIds = new Set(transcript.responses.map((r) => r.id));
  const claimEntries: { section: string; claim: BriefClaim }[] = [];
  for (const section of result.content.sections) {
    for (const claim of section.claims) claimEntries.push({ section: section.category, claim });
  }
  for (const claim of result.content.starred_moments) {
    claimEntries.push({ section: 'starred_moments', claim });
  }

  let transcriptStructuralOk = true;
  for (const { section, claim } of claimEntries) {
    const hasCitations = claim.citations.length > 0;
    const allCitationsValid = claim.citations.every((id) => responseIds.has(id));
    const ok = hasCitations && allCitationsValid;
    if (!ok) transcriptStructuralOk = false;
    allClaims.push({ transcriptName: transcript.name, section, text: claim.text, citations: claim.citations, structurallyOk: ok });
  }
  suite.check(
    `structural integrity: every claim cites an existing response id (${transcript.name})`,
    transcriptStructuralOk,
    `${claimEntries.length} claims checked`,
  );
}

// Check 2: support. Judge only structurally sound claims, since a claim
// with a missing or invalid citation has no valid cited text to judge
// against and is definitionally unsupported.
console.log(`Judging ${allClaims.length} claims for support (concurrency 6)...`);
const judged: JudgedClaim[] = await mapWithConcurrency(allClaims, 6, async (c, i) => {
  if (!c.structurallyOk) {
    return { ...c, supported: false, reason: 'claim has a missing or invalid citation, fails structural check' };
  }
  const transcript = transcripts.find((t) => t.name === c.transcriptName);
  if (!transcript) throw new Error(`unreachable: transcript ${c.transcriptName} not found`);
  const cited = transcript.responses.filter((r) => c.citations.includes(r.id));
  const verdict = await judgeClaim(pool, c.text, cited);
  console.log(
    `  [judge ${i + 1}/${allClaims.length}] ${c.transcriptName} :: supported=${verdict.supported} :: ${c.text.slice(0, 60)}`,
  );
  return { ...c, supported: verdict.supported, reason: verdict.reason };
});

const unsupported = judged.filter((c) => !c.supported);
suite.check(
  'zero unsupported claims across all 15 transcripts (PRD 8.3 threshold)',
  unsupported.length === 0,
  `${unsupported.length} of ${judged.length} claims unsupported`,
);

if (unsupported.length > 0) {
  console.log(`unsupported claims (${unsupported.length}):`);
  for (const u of unsupported) {
    console.log(`  [${u.transcriptName} / ${u.section}] "${u.text}" -> ${u.reason}`);
  }
}

// Check 3, report-only: every starred response reflected in
// starred_moments (at least one claim citing it). No PRD threshold, so
// this feeds recordEvalRun's metrics, not a suite.check() gate.
const starredCoverageReport = generations.map(({ transcript, result }) => {
  const starredIds = transcript.responses.filter((r) => r.starred).map((r) => r.id);
  const citedInStarredMoments = new Set(result.content.starred_moments.flatMap((c) => c.citations));
  const missed = starredIds.filter((id) => !citedInStarredMoments.has(id));
  return { transcript: transcript.name, starred_count: starredIds.length, missed };
});
const totalMissedStarred = starredCoverageReport.reduce((sum, r) => sum + r.missed.length, 0);
console.log(
  `report-only: starred moment coverage, ${totalMissedStarred} starred response(s) not reflected in starred_moments`,
);

// Check 4, report-only: open_questions non-empty on contradiction
// transcripts. No PRD threshold, report-only.
const openQuestionsReport = generations
  .filter(({ transcript }) => transcript.traits.includes('contradiction'))
  .map(({ transcript, result }) => ({
    transcript: transcript.name,
    open_questions_count: result.content.open_questions.length,
  }));
console.log(`report-only: open_questions on contradiction transcripts: ${JSON.stringify(openQuestionsReport)}`);

await recordEvalRun(pool, suite, 'claude-sonnet-4-6', {
  transcripts: transcripts.length,
  total_claims: judged.length,
  unsupported_claims: unsupported.length,
  unsupported_detail: unsupported.map((u) => ({ transcript: u.transcriptName, section: u.section, text: u.text, reason: u.reason })),
  starred_moments_report: starredCoverageReport,
  total_missed_starred: totalMissedStarred,
  open_questions_report: openQuestionsReport,
});
await pool.end();
process.exit(suite.passed ? 0 : 1);
