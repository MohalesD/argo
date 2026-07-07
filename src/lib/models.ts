// Production model routing (PRD 4.4, decisions D4 and D5).
// This allowlist mirrors the ai_calls CHECK constraint exactly. Adding a
// model here without the matching migration will fail at the database.

export const ALLOWED_MODELS = ['claude-haiku-4-5', 'claude-sonnet-4-6'] as const;
export type AllowedModel = (typeof ALLOWED_MODELS)[number];

export function assertAllowedModel(model: string): asserts model is AllowedModel {
  if (!(ALLOWED_MODELS as readonly string[]).includes(model)) {
    throw new Error(
      `Model '${model}' is not in the Argo production allowlist ` +
        `(${ALLOWED_MODELS.join(', ')}). Fable and Mythos class models never ` +
        `run as Argo's production runtime (CLAUDE.md hard boundary 1).`,
    );
  }
}

// Purpose-to-model routing table, verbatim from PRD Section 4.4.
export const MODEL_ROUTING = {
  question_compliance_classification: 'claude-haiku-4-5',
  tag_metadata_suggestion: 'claude-haiku-4-5',
  retrieval_rerank: 'claude-sonnet-4-6',
  followup_suggestion: 'claude-sonnet-4-6',
  brief_drafting: 'claude-sonnet-4-6',
  transport_smoke_test: 'claude-haiku-4-5',
  // Eval-harness judge (suite 8.3), not a production surface call.
  brief_faithfulness_judge: 'claude-haiku-4-5',
} as const satisfies Record<string, AllowedModel>;

export type Purpose = keyof typeof MODEL_ROUTING;

// USD per million tokens, for ai_calls.cost_usd (source: claude-api skill,
// cached 2026-06-24).
export const PRICING: Record<AllowedModel, { inputPerM: number; outputPerM: number }> = {
  'claude-haiku-4-5': { inputPerM: 1.0, outputPerM: 5.0 },
  'claude-sonnet-4-6': { inputPerM: 3.0, outputPerM: 15.0 },
};

export function costUsd(model: AllowedModel, tokensIn: number, tokensOut: number): number {
  const p = PRICING[model];
  return (tokensIn / 1_000_000) * p.inputPerM + (tokensOut / 1_000_000) * p.outputPerM;
}

export interface ModelRequest {
  model: AllowedModel;
  system?: string;
  prompt: string;
  maxTokens: number;
}

export interface ModelResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

export interface Transport {
  readonly name: string;
  complete(req: ModelRequest): Promise<ModelResponse>;
}
