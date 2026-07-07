import pg from 'pg';
import { logAiCall } from './ai-log.js';
import {
  assertAllowedModel,
  MODEL_ROUTING,
  type ModelResponse,
  type Purpose,
  type Transport,
} from './models.js';
import { AnthropicApiTransport } from './transports/anthropic-api.js';
import { ClaudeCliTransport } from './transports/claude-cli.js';

// The registry is the only path to a model transport (PRD 4.4 layer 2).
// It rejects non-allowlisted models in-process, before any transport is
// touched, and logs every completed call to ai_calls.

let transport: Transport | null = null;

export function getTransport(): Transport {
  if (!transport) {
    transport = process.env.ANTHROPIC_API_KEY
      ? new AnthropicApiTransport()
      : new ClaudeCliTransport();
  }
  return transport;
}

export async function callModel(
  pool: pg.Pool,
  purpose: Purpose,
  req: { system?: string; prompt: string; maxTokens: number; temperature?: number },
): Promise<ModelResponse> {
  const model = MODEL_ROUTING[purpose];
  assertAllowedModel(model);
  const response = await getTransport().complete({ model, ...req });
  await logAiCall(pool, {
    purpose,
    model,
    tokensIn: response.tokensIn,
    tokensOut: response.tokensOut,
  });
  return response;
}
