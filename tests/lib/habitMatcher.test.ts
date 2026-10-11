import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { habitMatcherName, matchHabit, type MatchableHabit } from '@/lib/habitMatcher';

// The AI model, which the "llm" matcher asks
const { generateObject } = vi.hoisted(() => ({ generateObject: vi.fn() }));
vi.mock('ai', () => ({ generateObject }));

const habit = (id: string, name: string, extra: Partial<MatchableHabit> = {}): MatchableHabit =>
  ({ id, name, description: null, schema: '{"type":"object","properties":{}}', aiContext: null, ...extra });

const habits = [
  habit('piano', 'Piano Practice'),
  habit('run', 'Morning Run', { schema: '{"type":"object","properties":{"distance":{"type":"number","title":"Distance"}}}' }),
  habit('bike', 'Commute', { aiContext: 'my bike ride to work' }),
];

beforeEach(() => {
  generateObject.mockReset();
  // Cleared so each test starts from a setup with nothing set
  for (const name of ['HABIT_MATCHER', 'TYPESAFE_API_KEY', 'AI_MODEL', 'GOOGLE_GENERATIVE_AI_API_KEY', 'AI_BASE_URL']) vi.stubEnv(name, undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('habitMatcherName', () => {
  it('uses Jev when there is a TypeSafe key, otherwise the AI model, otherwise none', () => {
    expect(habitMatcherName()).toBe('none');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test');
    expect(habitMatcherName()).toBe('llm');
    vi.stubEnv('TYPESAFE_API_KEY', 'test');
    expect(habitMatcherName()).toBe('jev');
  });

  it('counts the AI model as set up only when its provider has what it needs', () => {
    vi.stubEnv('AI_MODEL', 'local:qwen3:8b');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test');
    expect(habitMatcherName()).toBe('none');
    vi.stubEnv('AI_BASE_URL', 'http://localhost:11434/v1');
    expect(habitMatcherName()).toBe('llm');
    vi.stubEnv('AI_MODEL', 'nonsense');
    expect(habitMatcherName()).toBe('none');
  });

  it('follows HABIT_MATCHER over what is set up, and refuses one it doesn\'t know', () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'test');
    vi.stubEnv('HABIT_MATCHER', 'None');
    expect(habitMatcherName()).toBe('none');
    vi.stubEnv('HABIT_MATCHER', 'embeddings');
    expect(() => habitMatcherName()).toThrow(/isn't one of: jev, llm, none/);
  });
});

describe('matching with the AI model', () => {
  it('acts on a habit it is sure of, followed by its alternatives', async () => {
    generateObject.mockResolvedValue({ object: { habit: '1', sure: true, alternatives: ['new', '1', '9'], kind: 'did' } });
    expect(await matchHabit('practiced keys', habits, 'llm')).toEqual({
      confident: true,
      candidates: [
        { habitId: 'piano', name: 'Piano Practice', probability: null },
        { habitId: null, name: 'New habit', probability: null },
      ],
      didIt: true,
    });
    // The habits are numbered for it, with what each records and the user's notes
    const { system } = generateObject.mock.calls[0][0];
    expect(system).toContain('1. Piano Practice');
    expect(system).toContain('2. Morning Run {"records":["Distance"]}');
    expect(system).toContain('3. Commute {"users_notes":"my bike ride to work"}');
  });

  it('asks the user when it isn\'t sure, and reads an intention as nothing done', async () => {
    generateObject.mockResolvedValue({ object: { habit: '2', sure: false, alternatives: ['3'], kind: 'intends' } });
    const match = await matchHabit('want to move more', habits, 'llm');
    expect(match.confident).toBe(false);
    expect(match.candidates.map(c => c.habitId)).toEqual(['run', 'bike']);
    expect(match.didIt).toBe(false);
  });

  it('only asks whether it was done when there are no habits', async () => {
    generateObject.mockResolvedValue({ object: { kind: 'did' } });
    expect(await matchHabit('yoga', [], 'llm')).toEqual({ confident: true, candidates: [{ habitId: null, name: 'New habit', probability: null }], didIt: true });
  });
});

describe('matching by words', () => {
  it('ranks habits by shared words, the name counting most, and always asks', async () => {
    const match = await matchHabit('biked to work this morning', habits, 'none');
    expect(match.confident).toBe(false);
    expect(match.didIt).toBe(true);
    expect(match.candidates.map(c => c.habitId)).toEqual(['run', 'bike', 'piano']);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it('counts different endings of a word as the same word', async () => {
    const match = await matchHabit('practicing the piano', habits, 'none');
    expect(match.candidates[0].habitId).toBe('piano');
  });
});
