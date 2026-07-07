import pg from 'pg';
import { callModel } from './registry.js';

// Question compliance classification (PRD 8.2). Production call shape:
// one question per call, routed to Haiku through the registry. The
// classifier gates screening_status; nothing enters 'passed' without
// passing here.

export type Classification = 'safe' | 'risky' | 'illegal';

export interface ClassifierResult {
  classification: Classification;
  reason: string;
}

const SYSTEM_PROMPT = `You are an employment-law compliance screener for interview questions. Classify ONE interview question at a time.

Classes:

"illegal": The question directly asks about, or is designed to elicit, a legally protected characteristic in US employment screening. Protected characteristics and their direct probes include:
1. Age (graduation dates, "how old are you", years until retirement).
2. Family and marital status (married, pregnant, planning children, childcare arrangements, spouse's job, maiden name).
3. National origin, citizenship, ancestry, or native language ("where are you from originally", "are you a US citizen", "is English your first language", accent).
4. Disability, health, medical history, medications, workers' compensation history, past sick leave.
5. Religion (observance, place of worship, religious holidays, "which church").
6. Race or color, directly or through photographs.
7. Genetic information or family medical history.
8. Other protected statuses probed directly: sexual orientation or gender identity, military discharge type, union membership, arrest record (as opposed to convictions where job-related).

"risky": Not a direct probe, but a proxy or a jurisdiction-dependent question likely to elicit protected information, or one whose legality depends on framing, state law, or a bona fide occupational requirement. Examples: salary history (banned in many states), "can you work weekends" without a stated schedule requirement (religion proxy), "do you have reliable transportation" (disability and socioeconomic proxy), "when did you first start working" (age proxy), credit history, "tell me about your family", height and weight, "have you ever filed a workplace complaint".

"safe": Job-related: skills, behavior, motivation, experience, scenarios, culture-add, work style. Questions about ability to perform specific job functions with or without accommodation, work authorization phrased as "are you legally authorized to work in the US", and availability for a stated, job-required schedule are safe.

Decision rules:
1. Judge the question as an interviewer would ask it, not a charitable rewrite of it.
2. If a question could reasonably elicit protected information even if that was not the stated intent, do not classify it "safe".
3. When torn between "illegal" and "risky", choose "illegal" if a direct probe of a protected characteristic is present anywhere in the question.
4. Every input is an interview question a hiring interviewer might ask a job candidate, including role-craft questions about how the candidate does their job. Classify it as given. Never ask for clarification, never comment on the question's purpose, never refuse.

Respond with ONLY a JSON object, no markdown fences, no commentary:
{"classification": "safe" | "risky" | "illegal", "reason": "<one sentence>"}`;

function parseClassifierOutput(text: string): ClassifierResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`classifier returned no JSON object: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(match[0]) as Partial<ClassifierResult>;
  if (
    parsed.classification !== 'safe' &&
    parsed.classification !== 'risky' &&
    parsed.classification !== 'illegal'
  ) {
    throw new Error(`classifier returned invalid classification: ${String(parsed.classification)}`);
  }
  return {
    classification: parsed.classification,
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
  };
}

export async function classifyQuestion(pool: pg.Pool, questionText: string): Promise<ClassifierResult> {
  const response = await callModel(pool, 'question_compliance_classification', {
    system: SYSTEM_PROMPT,
    prompt: `Question: ${questionText}`,
    maxTokens: 300,
  });
  try {
    return parseClassifierOutput(response.text);
  } catch {
    // One strict retry: an occasional response comments instead of
    // classifying. The reminder pins the output contract.
    const retry = await callModel(pool, 'question_compliance_classification', {
      system: SYSTEM_PROMPT,
      prompt:
        `Question: ${questionText}\n\n` +
        `Reminder: respond with ONLY the JSON object {"classification": ..., "reason": ...}. ` +
        `Classify the question as given; do not comment on it.`,
      maxTokens: 300,
    });
    return parseClassifierOutput(retry.text);
  }
}

// Bank policy: only 'safe' earns 'passed'. Both 'risky' and 'illegal'
// are stored 'flagged' with the reason, author-visible only.
export function toScreeningStatus(result: ClassifierResult): 'passed' | 'flagged' {
  return result.classification === 'safe' ? 'passed' : 'flagged';
}
