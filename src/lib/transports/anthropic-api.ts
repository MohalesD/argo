import Anthropic from '@anthropic-ai/sdk';
import type { ModelRequest, ModelResponse, Transport } from '../models.js';

// Production transport: the official SDK against the Anthropic API.
// Requires ANTHROPIC_API_KEY (or an ant auth profile) in the environment.
export class AnthropicApiTransport implements Transport {
  readonly name = 'anthropic-api';
  private client = new Anthropic();

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const response = await this.client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      ...(req.system ? { system: req.system } : {}),
      messages: [{ role: 'user', content: req.prompt }],
    });
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return {
      text,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
    };
  }
}
