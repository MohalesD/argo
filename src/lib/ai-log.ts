import pg from 'pg';
import { costUsd, type AllowedModel } from './models.js';

// Every model call lands in ai_calls (PRD 4.4 layer 1). The CHECK
// constraint on ai_calls.model is the structural backstop; this insert
// will throw if anything upstream ever slipped a non-allowlisted model.
export async function logAiCall(
  pool: pg.Pool,
  entry: { purpose: string; model: AllowedModel; tokensIn: number; tokensOut: number },
): Promise<void> {
  await pool.query(
    'insert into ai_calls (purpose, model, tokens_in, tokens_out, cost_usd) values ($1, $2, $3, $4, $5)',
    [
      entry.purpose,
      entry.model,
      entry.tokensIn,
      entry.tokensOut,
      costUsd(entry.model, entry.tokensIn, entry.tokensOut).toFixed(6),
    ],
  );
}
