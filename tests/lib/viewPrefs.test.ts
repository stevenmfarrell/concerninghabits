import { describe, expect, it } from 'vitest';
import { DEFAULT_HORIZON, LEGACY_VIEW_COOKIE, pageView, parseHorizon, withPageView } from '@/lib/viewPrefs';

describe('parseHorizon', () => {
  it('takes one of the offered ranges, and the default for anything else', () => {
    expect(parseHorizon('52')).toBe(52);
    expect(parseHorizon(5)).toBe(5);
    expect(parseHorizon('abc')).toBe(DEFAULT_HORIZON);
    expect(parseHorizon('13')).toBe(DEFAULT_HORIZON);
    expect(parseHorizon(undefined)).toBe(DEFAULT_HORIZON);
  });
});

describe('pageView', () => {
  const views = { h1: { horizon: 52, chart: 'pace', chartTypes: { pace: 'bar' }, chartPeriods: { weekly: 'month' } } };

  it('reads a page\'s view from the cookie, encoded or not', () => {
    expect(pageView(JSON.stringify(views), 'h1')).toEqual(views.h1);
    expect(pageView(encodeURIComponent(JSON.stringify(views)), 'h1')).toEqual(views.h1);
    expect(pageView(JSON.stringify(views), 'other')).toEqual({});
  });

  it('leaves out anything that isn\'t a view, rather than failing', () => {
    expect(pageView(undefined, 'h1')).toEqual({});
    expect(pageView('not json', 'h1')).toEqual({});
    expect(pageView(JSON.stringify({ h1: { horizon: 13 } }), 'h1')).toEqual({});
    expect(pageView(JSON.stringify({ h1: { chartPeriods: { c: 'fortnight' } }, h2: { horizon: 5 } }), 'h2')).toEqual({ horizon: 5 });
  });
});

describe('withPageView', () => {
  it('merges a change into a page\'s view, and forgets a chart period given null', () => {
    const first = withPageView({}, 'h1', { horizon: 5, chartTypes: { pace: 'bar' }, chartPeriods: { weekly: 'month' } });
    const next = withPageView(first, 'h1', { chart: 'pace', chartTypes: { speed: 'line' }, chartPeriods: { weekly: null } });
    expect(next.h1).toEqual({ horizon: 5, chart: 'pace', chartTypes: { pace: 'bar', speed: 'line' }, chartPeriods: {} });
  });

  it('ignores a period that isn\'t one a chart can be shown by', () => {
    expect(withPageView({}, 'h1', { chartPeriods: { weekly: 'fortnight' } }).h1.chartPeriods).toEqual({});
  });

  it('keeps only the pages changed most recently', () => {
    let views = {};
    for (let i = 0; i < 40; i++) views = withPageView(views, `page${i}`, { horizon: 5 });
    const ids = Object.keys(views);
    expect(ids).toHaveLength(30);
    expect(ids.at(-1)).toBe('page39');
    expect(ids).not.toContain('page9');
    // Changing an older page moves it to the end
    expect(Object.keys(withPageView(views, 'page10', { horizon: 52 })).at(-1)).toBe('page10');
  });

  it('stays within what a browser keeps for a cookie', () => {
    let views = {};
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`chart-with-a-long-id-${i}`, 'line' as const]));
    for (let i = 0; i < 30; i++) views = withPageView(views, `a-habit-id-${i}`, { chartTypes: many });
    expect(encodeURIComponent(JSON.stringify(views)).length).toBeLessThanOrEqual(3000);
    expect(Object.keys(views).at(-1)).toBe('a-habit-id-29');
  });
});

describe('LEGACY_VIEW_COOKIE', () => {
  it('matches the per-page cookies the views cookie replaced, and nothing else', () => {
    for (const name of ['horizon_abc', 'chartField_abc', 'chartType_abc_def', 'chartPeriod_abc_def']) expect(LEGACY_VIEW_COOKIE.test(name)).toBe(true);
    for (const name of ['views', 'session', 'tz', 'habitsView', 'horizon']) expect(LEGACY_VIEW_COOKIE.test(name)).toBe(false);
  });
});
