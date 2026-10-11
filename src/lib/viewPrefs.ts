import { z } from 'zod';

// How the viewer last left a habit's or category's page, remembered in one cookie so the server
// renders it that way next time: its activity calendar's time range, and for a habit, which chart
// it shows and how each chart is drawn. The Habits page's own choices are in habitsView.ts.
//
// One cookie for every page rather than one per page and chart, which the browser would send with
// every request: it keeps only the pages changed most recently, within a size the browser takes.
export const VIEWS_COOKIE = 'views';
// Older cookies this one replaced, one per habit (and per chart), cleared by proxy.ts
export const LEGACY_VIEW_COOKIE = /^(horizon|chartField|chartType|chartPeriod)_/;

const MAX_PAGES = 30;
// Of the 4 KB a browser keeps for a cookie, leaving room for its name and attributes
const MAX_COOKIE_BYTES = 3000;
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

// The time ranges the activity calendar offers, in weeks (see HorizonToggle)
export const HORIZON_WEEKS = [5, 26, 52] as const;
export type HorizonWeeks = (typeof HORIZON_WEEKS)[number];
export const DEFAULT_HORIZON: HorizonWeeks = 26;

const CHART_PERIOD_CHOICES = ['entry', 'day', 'week', 'month', 'rolling'] as const;
type ChartPeriodChoice = (typeof CHART_PERIOD_CHOICES)[number];
const isChartPeriodChoice = (value: string): value is ChartPeriodChoice => (CHART_PERIOD_CHOICES as readonly string[]).includes(value);

const chartId = z.string().min(1).max(64);
const pageViewSchema = z.object({
  horizon: z.union([z.literal(5), z.literal(26), z.literal(52)]).optional(),
  // The chart shown, and the charts drawn other than as made (lines or bars, and the period a
  // custom chart was switched to, see periodChoices)
  chart: chartId.optional(),
  chartTypes: z.record(chartId, z.enum(['line', 'bar'])).optional(),
  chartPeriods: z.record(chartId, z.enum(CHART_PERIOD_CHOICES)).optional(),
});
export type PageView = z.infer<typeof pageViewSchema>;
type Views = Record<string, PageView>;
// A change to a page's view; a chart period of null forgets it, so the chart is shown by its own
// period again
export type PageViewChange = Pick<PageView, 'horizon' | 'chart' | 'chartTypes'> & { chartPeriods?: Record<string, string | null> };

// Every page's view from the cookie's value, leaving out anything that isn't one
function parseViews(raw: string | undefined): Views {
  if (!raw) return {};
  for (const text of [raw, safeDecode(raw)]) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).flatMap(([id, view]) => {
        const result = pageViewSchema.safeParse(view);
        return result.success ? [[id, result.data]] : [];
      }));
    } catch {
      // Not JSON as it is: try it decoded
    }
  }
  return {};
}

function safeDecode(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// How the viewer last left page `id` (a habit's or category's), from the cookie's value
export function pageView(raw: string | undefined, id: string): PageView {
  return parseViews(raw)[id] ?? {};
}

// A time range from the address bar or a saved view, or the default for anything else
export function parseHorizon(value: string | number | undefined): HorizonWeeks {
  const weeks = Number(value);
  return HORIZON_WEEKS.find(w => w === weeks) ?? DEFAULT_HORIZON;
}

// `views` with page `id` changed by `change`, most recent last, keeping as many of the latest as fit
export function withPageView(views: Views, id: string, change: PageViewChange): Views {
  const current = views[id] ?? {};
  const chartPeriods = { ...current.chartPeriods };
  for (const [chart, period] of Object.entries(change.chartPeriods ?? {})) {
    if (period === null) delete chartPeriods[chart];
    else if (isChartPeriodChoice(period)) chartPeriods[chart] = period;
  }
  const next: PageView = {
    ...current,
    ...(change.horizon !== undefined ? { horizon: change.horizon } : {}),
    ...(change.chart !== undefined ? { chart: change.chart } : {}),
    chartTypes: { ...current.chartTypes, ...change.chartTypes },
    chartPeriods,
  };
  const rest = Object.entries(views).filter(([key]) => key !== id);
  let entries = [...rest, [id, next] as const].slice(-MAX_PAGES);
  while (entries.length > 1 && encodeURIComponent(JSON.stringify(Object.fromEntries(entries))).length > MAX_COOKIE_BYTES) {
    entries = entries.slice(1);
  }
  return Object.fromEntries(entries);
}

// In the browser: remembers a change to how page `id` is viewed (see withPageView), and clears the
// older per-page cookies this one replaced
export function rememberPageView(id: string, change: PageViewChange) {
  const cookies = document.cookie.split('; ').map(c => [c.slice(0, c.indexOf('=')), c.slice(c.indexOf('=') + 1)] as const);
  const raw = cookies.find(([name]) => name === VIEWS_COOKIE)?.[1];
  const views = withPageView(parseViews(raw), id, change);
  document.cookie = `${VIEWS_COOKIE}=${encodeURIComponent(JSON.stringify(views))}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
  for (const [name] of cookies) {
    if (LEGACY_VIEW_COOKIE.test(name)) document.cookie = `${name}=; path=/; max-age=0`;
  }
}
