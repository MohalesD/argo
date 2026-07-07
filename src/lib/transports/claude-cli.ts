import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { ModelRequest, ModelResponse, Transport } from '../models.js';

// The WindowsApps execution alias for claude.exe does not spawn from
// Node; resolve the real binary instead.
function resolveClaudeBinary(): string {
  if (process.env.CLAUDE_CLI_PATH) return process.env.CLAUDE_CLI_PATH;
  const nativeInstall = path.join(homedir(), '.local', 'bin', 'claude.exe');
  if (process.platform === 'win32' && existsSync(nativeInstall)) return nativeInstall;
  return 'claude';
}

// Development fallback transport: Claude CLI headless mode. Used when no
// ANTHROPIC_API_KEY is present. The model allowlist is enforced upstream
// in the registry regardless of transport; the CLI still runs the real
// allowlisted model. The system prompt is folded into the single-turn
// prompt, which is acceptable for dev screening runs; production uses
// the API transport with a proper system parameter.
export class ClaudeCliTransport implements Transport {
  readonly name = 'claude-cli';

  complete(req: ModelRequest): Promise<ModelResponse> {
    const fullPrompt = req.system ? `${req.system}\n\n---\n\n${req.prompt}` : req.prompt;
    const args = ['-p', '--model', req.model, '--output-format', 'json'];

    return new Promise((resolve, reject) => {
      const child = spawn(resolveClaudeBinary(), args, { timeout: 180_000 });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => (stdout += d));
      child.stderr.on('data', (d) => (stderr += d));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`claude CLI exited ${code}: ${stderr.slice(0, 400)}`));
          return;
        }
        try {
          const parsed = JSON.parse(stdout) as {
            result?: string;
            is_error?: boolean;
            usage?: { input_tokens?: number; output_tokens?: number };
          };
          if (parsed.is_error) {
            reject(new Error(`claude CLI returned error: ${String(parsed.result).slice(0, 400)}`));
            return;
          }
          resolve({
            text: parsed.result ?? '',
            tokensIn: parsed.usage?.input_tokens ?? 0,
            tokensOut: parsed.usage?.output_tokens ?? 0,
          });
        } catch (err) {
          reject(new Error(`could not parse claude CLI output: ${(err as Error).message}`));
        }
      });
      child.stdin.write(fullPrompt);
      child.stdin.end();
    });
  }
}
