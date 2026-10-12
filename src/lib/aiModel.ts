// The model every AI request uses (see src/app/actions/habit.ts and smartEntry.ts), chosen with
// environment variables so a self-hosted instance can bring its own:
//
//   AI_MODEL="<provider>:<model>"   e.g. "anthropic:claude-haiku-4-5", "local:qwen3:8b"
//
// Providers: google, anthropic and openai read their usual API key variable
// (GOOGLE_GENERATIVE_AI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY). "local" is any
// OpenAI-compatible server (Ollama, LM Studio, llama.cpp, vLLM, LiteLLM, OpenRouter) at
// AI_BASE_URL, with AI_API_KEY sent if it's set.
//
// AI_REASONING_EFFORT, if set, is how much a thinking model thinks before answering, for any
// provider: "none" turns it off (e.g. Qwen 3.5 on Ollama, where it took a form fill from 20 seconds
// to under one). Each provider maps it to its own setting (Ollama's `reasoning_effort`, Gemini's
// thinking budget, Claude's extended thinking). Server-only.

import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware } from 'ai';

const DEFAULT_MODEL = 'google:gemini-flash-lite-latest';

const PROVIDERS: Record<string, (modelId: string) => Exclude<LanguageModel, string>> = {
  google: modelId => google(modelId),
  anthropic: modelId => anthropic(modelId),
  openai: modelId => openai(modelId),
  local: modelId => {
    const baseURL = process.env.AI_BASE_URL;
    if (!baseURL) throw new Error('AI_MODEL uses a "local" model, so AI_BASE_URL must be set (e.g. http://localhost:11434/v1 for Ollama).');
    return createOpenAICompatible({
      name: 'local',
      baseURL,
      apiKey: process.env.AI_API_KEY || undefined,
      // Every request asks for an object matching a schema. Ollama, LM Studio, llama.cpp and vLLM
      // all accept a JSON schema as the response format, which small models need to stay on it.
      supportsStructuredOutputs: true,
    }).chatModel(modelId);
  },
};

// Split on the first colon only, since model names can contain one (Ollama's "qwen3:8b")
export function parseModelSpec(spec: string): { provider: string; modelId: string } {
  const separator = spec.indexOf(':');
  const provider = separator === -1 ? '' : spec.slice(0, separator).trim();
  const modelId = separator === -1 ? '' : spec.slice(separator + 1).trim();
  if (!provider || !modelId) {
    throw new Error(`AI_MODEL must look like "<provider>:<model>" (e.g. "google:gemini-flash-lite-latest"), not "${spec}".`);
  }
  if (!(provider in PROVIDERS)) {
    throw new Error(`AI_MODEL's provider "${provider}" isn't one of: ${Object.keys(PROVIDERS).join(', ')}.`);
  }
  return { provider, modelId };
}

// What each provider needs set before it can make a request
const REQUIRED_SETTING: Record<string, string> = {
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  local: 'AI_BASE_URL',
};

function modelSpec() {
  return process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
}

// Whether AI_MODEL is valid and its provider has what it needs, i.e. whether a request could be made
export function aiModelConfigured(): boolean {
  try {
    return !!process.env[REQUIRED_SETTING[parseModelSpec(modelSpec()).provider]];
  } catch {
    return false;
  }
}

const REASONING_EFFORTS = ['provider-default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;
type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

function reasoningEffort(): ReasoningEffort | undefined {
  const set = process.env.AI_REASONING_EFFORT?.trim().toLowerCase();
  if (!set) return undefined;
  if (!(REASONING_EFFORTS as readonly string[]).includes(set)) {
    throw new Error(`AI_REASONING_EFFORT "${set}" isn't one of: ${REASONING_EFFORTS.join(', ')}.`);
  }
  return set as ReasoningEffort;
}

// Settings every request gets, unless the request sets its own. Like the SDK's
// defaultSettingsMiddleware, which doesn't take `reasoning` yet.
function defaultReasoning(reasoning: ReasoningEffort): LanguageModelMiddleware {
  return {
    specificationVersion: 'v4',
    transformParams: async ({ params }) => ({ ...params, reasoning: params.reasoning ?? reasoning }),
  };
}

// Made on first use rather than at import, so a misconfiguration shows up as an AI request failing
// with a clear message instead of breaking the build or the pages that make no AI requests
let model: LanguageModel | undefined;
export function aiModel(): LanguageModel {
  if (!model) {
    const { provider, modelId } = parseModelSpec(modelSpec());
    const reasoning = reasoningEffort();
    const base = PROVIDERS[provider](modelId);
    model = reasoning ? wrapLanguageModel({ model: base, middleware: defaultReasoning(reasoning) }) : base;
  }
  return model;
}
