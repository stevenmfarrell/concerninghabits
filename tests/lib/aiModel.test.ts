import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateObject } from 'ai';
import { z } from 'zod';
import { aiFailureMessage, aiTimeoutMs, parseModelSpec } from '@/lib/aiModel';

// aiModel() keeps the model it makes, so each case loads the module afresh
async function modelFor(env: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  const { aiModel } = await import('@/lib/aiModel');
  return aiModel() as { provider: string; modelId: string };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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

  describe('AI_REASONING_EFFORT', () => {
    // The body of the request a local model is sent, answered with an empty object
    async function requestBodyFor(env: Record<string, string | undefined>, call: { reasoning?: 'high' } = {}) {
      const fetch = vi.fn(async () => Response.json({
        id: 'x', object: 'chat.completion', created: 0, model: 'qwen3.5:4b',
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '{}' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }));
      vi.stubGlobal('fetch', fetch);
      const model = await modelFor({ AI_MODEL: 'local:qwen3.5:4b', AI_BASE_URL: 'http://localhost:11434/v1', ...env });
      await generateObject({ model: model as never, schema: z.object({}), prompt: 'hi', ...call });
      return JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    }

    it('is sent with every request, unless the request sets its own', async () => {
      expect((await requestBodyFor({ AI_REASONING_EFFORT: 'None' })).reasoning_effort).toBe('none');
      expect((await requestBodyFor({ AI_REASONING_EFFORT: 'none' }, { reasoning: 'high' })).reasoning_effort).toBe('high');
    });

    it('leaves the provider\'s default alone when unset', async () => {
      expect(await requestBodyFor({ AI_REASONING_EFFORT: undefined })).not.toHaveProperty('reasoning_effort');
    });

    it('refuses an effort it doesn\'t know', async () => {
      await expect(modelFor({ AI_REASONING_EFFORT: 'off' })).rejects.toThrow(/isn't one of: provider-default, none/);
    });
  });
});

describe('AI_TIMEOUT_SECONDS', () => {
  it('is a minute unless set', () => {
    expect(aiTimeoutMs()).toBe(60_000);
    vi.stubEnv('AI_TIMEOUT_SECONDS', '90');
    expect(aiTimeoutMs()).toBe(90_000);
  });

  it('refuses a time that isn\'t above 0', () => {
    for (const value of ['0', '-5', 'soon']) {
      vi.stubEnv('AI_TIMEOUT_SECONDS', value);
      expect(() => aiTimeoutMs()).toThrow(/AI_TIMEOUT_SECONDS/);
    }
  });

  it('says a request took too long when that\'s why it failed', async () => {
    const timedOut = await new Promise<unknown>(resolve => {
      const signal = AbortSignal.timeout(1);
      signal.addEventListener('abort', () => resolve(signal.reason));
    });
    expect(aiFailureMessage(timedOut, 'Failed.')).toMatch(/too long/);
    expect(aiFailureMessage(new Error('Bad gateway'), 'Failed.')).toBe('Failed.');
  });
});
