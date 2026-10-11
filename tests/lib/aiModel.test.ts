import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseModelSpec } from '@/lib/aiModel';

// aiModel() keeps the model it makes, so each case loads the module afresh
async function modelFor(env: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  const { aiModel } = await import('@/lib/aiModel');
  return aiModel() as { provider: string; modelId: string };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('parseModelSpec', () => {
  it('splits on the first colon, so model names can contain one', () => {
    expect(parseModelSpec('anthropic:claude-haiku-4-5')).toEqual({ provider: 'anthropic', modelId: 'claude-haiku-4-5' });
    expect(parseModelSpec('local:qwen3:8b')).toEqual({ provider: 'local', modelId: 'qwen3:8b' });
  });

  it('refuses a spec without a provider or model, or with an unknown provider', () => {
    expect(() => parseModelSpec('gemini-flash-lite-latest')).toThrow(/<provider>:<model>/);
    expect(() => parseModelSpec('google:')).toThrow(/<provider>:<model>/);
    expect(() => parseModelSpec(':gpt-5-mini')).toThrow(/<provider>:<model>/);
    expect(() => parseModelSpec('mistral:large')).toThrow(/isn't one of: google, anthropic, openai, local/);
  });
});

describe('aiModel', () => {
  it('defaults to Gemini Flash Lite', async () => {
    const model = await modelFor({ AI_MODEL: undefined });
    expect(model.provider).toMatch(/^google/);
    expect(model.modelId).toBe('gemini-flash-lite-latest');
  });

  it('uses the provider and model AI_MODEL names', async () => {
    const model = await modelFor({ AI_MODEL: 'anthropic:claude-haiku-4-5', ANTHROPIC_API_KEY: 'test' });
    expect(model.provider).toMatch(/^anthropic/);
    expect(model.modelId).toBe('claude-haiku-4-5');
  });

  it('points a local model at AI_BASE_URL, and needs one', async () => {
    const model = await modelFor({ AI_MODEL: 'local:qwen3:8b', AI_BASE_URL: 'http://localhost:11434/v1' });
    expect(model.provider).toMatch(/^local/);
    expect(model.modelId).toBe('qwen3:8b');

    await expect(modelFor({ AI_MODEL: 'local:qwen3:8b', AI_BASE_URL: undefined })).rejects.toThrow(/AI_BASE_URL must be set/);
  });
});
