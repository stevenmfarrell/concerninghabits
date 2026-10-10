import { describe, expect, it } from 'vitest';
import { buildDueList, listRowStatus, type CategoryTree } from '@/lib/dueList';
import type { HabitListItem } from '@/lib/types';
import type { Cadence } from '@/lib/cadence';

const user = { timeZone: 'UTC', bedtime: '00:00', weekStartsOn: 'sunday' };
// Saturday, October 3rd 2026, mid-afternoon
const now = new Date('2026-10-03T15:00:00Z');
const today = new Date('2026-10-03T09:00:00Z');

function habit(id: string, cadence: Cadence, logs: { createdAt: Date; userId: string }[] = []): HabitListItem {
  return { id, name: id, schema: '{}', cadence: JSON.stringify(cadence), userId: 'me', logs };
}

function category(id: string, cadence: Cadence, habits: HabitListItem[], children: CategoryTree['children'] = [], order = 0): CategoryTree {
  return { id, name: id, icon: null, cadence: JSON.stringify(cadence), habits, children, order };
}

const ordered = (h: HabitListItem, order: number): HabitListItem => ({ ...h, order });

const daily: Cadence = { type: 'daily', timesPerDay: 1 };
const none: Cadence = { type: 'none' };
const ids = (items: { id: string }[]) => items.map(i => i.id);

describe('buildDueList', () => {
  it('lists habits with a cadence as due or done, and leaves out ones without', () => {
    const list = buildDueList([category('Fitness', none, [
      habit('run', daily),
      habit('stretch', daily, [{ createdAt: today, userId: 'me' }]),
      habit('dessert', none),
    ])], [], {}, user, now);
    expect(ids(list.dueHabits)).toEqual(['run']);
    expect(ids(list.doneHabits)).toEqual(['stretch']);
  });

  it('counts someone else\'s entry on a shared habit', () => {
    const list = buildDueList([], [habit('trash', daily, [{ createdAt: today, userId: 'partner' }])], {}, user, now);
    expect(ids(list.doneHabits)).toEqual(['trash']);
  });

  it('completes a category with an entry on any of its habits, its subcategories\' included', () => {
    const cardio = category('Cardio', none, [habit('bike', none, [{ createdAt: today, userId: 'me' }])]);
    const list = buildDueList([category('Fitness', daily, [habit('pushups', none)], [cardio])], [], {}, user, now);
    expect(ids(list.doneCategories)).toEqual(['Fitness']);
    expect(ids(list.doneCategories[0].habits)).toEqual(['pushups', 'bike']);
  });

  it('lays out a category\'s habits to pick from in its order, each subcategory\'s under its name', () => {
    const cardio = category('Cardio', none, [habit('bike', none), habit('swim', none)], [], 1);
    const empty = category('Empty', none, [], [], 2);
    const strength = category('Strength', none, [habit('lift', none)], [], 4);
    const fitness = category('Fitness', daily, [ordered(habit('stretch', none), 0), ordered(habit('pushups', none), 3), ordered(habit('walk', none), 3)], [strength, cardio, empty]);
    const [due] = buildDueList([fitness], [], {}, user, now).dueCategories;
    expect(due.sections.map(s => [s.subcategory?.name ?? null, ids(s.habits)])).toEqual([
      [null, ['stretch']],
      ['Cardio', ['bike', 'swim']],
      [null, ['pushups', 'walk']],
      ['Strength', ['lift']],
    ]);
  });

  it('lays out a category with no subcategories as one section', () => {
    const [due] = buildDueList([category('Cardio', daily, [habit('bike', none), habit('run', none)])], [], {}, user, now).dueCategories;
    expect(due.sections.map(s => [s.subcategory, ids(s.habits)])).toEqual([[null, ['bike', 'run']]]);
  });

  it('lists a due subcategory with only its own habits', () => {
    const cardio = category('Cardio', daily, [habit('bike', none)]);
    const list = buildDueList([category('Fitness', none, [habit('pushups', none)], [cardio])], [], {}, user, now);
    expect(ids(list.dueCategories)).toEqual(['Cardio']);
    expect(ids(list.dueCategories[0].habits)).toEqual(['bike']);
  });

  it('lists a habit with a cadence and the category with a cadence it\'s in, both', () => {
    const list = buildDueList([category('Cardio', daily, [habit('run', daily)])], [], {}, user, now);
    expect(ids(list.dueCategories)).toEqual(['Cardio']);
    expect(ids(list.dueHabits)).toEqual(['run']);
  });

  it('gives how far along a due habit that takes several entries a day is, counting only today\'s', () => {
    const yesterday = new Date('2026-10-02T09:00:00Z');
    const water = habit('water', { type: 'daily', timesPerDay: 4 }, [today, today, yesterday].map(createdAt => ({ createdAt, userId: 'me' })));
    const list = buildDueList([], [water, habit('run', daily)], {}, user, now);
    expect(ids(list.dueHabits)).toEqual(['water', 'run']);
    expect(list.statuses).toMatchObject({
      water: { done: 2, needed: 4, period: 'daily', dueInDays: null },
      // Once a day: a single entry to go
      run: { done: 0, needed: 1, period: null, dueInDays: null },
    });
  });

  it('gives how far along a due category that takes several entries a week is, from any of its habits', () => {
    const thriceWeekly: Cadence = { type: 'calendarWeek', times: 3 };
    const monday = new Date('2026-09-28T09:00:00Z');
    const music = category('Music', thriceWeekly, [
      habit('piano', none, [{ createdAt: monday, userId: 'me' }]),
      habit('guitar', none, [{ createdAt: today, userId: 'me' }]),
    ]);
    const list = buildDueList([music], [], {}, user, now);
    // Saturday, the week's last day
    expect(list.dueCategories).toMatchObject([{ id: 'Music', status: { done: 2, needed: 3, period: 'weekly', dueInDays: 0 } }]);
  });

  it('leaves out the status of a habit once it\'s done', () => {
    const water = habit('water', { type: 'daily', timesPerDay: 2 }, [today, today].map(createdAt => ({ createdAt, userId: 'me' })));
    expect(buildDueList([], [water], {}, user, now).statuses).toEqual({});
  });

  it('counts down to when an every-N-days habit is due: before, on the day, and once overdue, but not before its first entry', () => {
    const everyThreeDays: Cadence = { type: 'everyNDays', days: 3 };
    const loggedOn = (iso: string) => [{ createdAt: new Date(iso), userId: 'me' }];
    // Saturday's habit was last done Wednesday, so it's due today; the other one was due Thursday
    const list = buildDueList([], [
      habit('due today', everyThreeDays, loggedOn('2026-09-30T09:00:00Z')),
      habit('overdue', everyThreeDays, loggedOn('2026-09-28T09:00:00Z')),
      habit('never', everyThreeDays),
    ], {}, user, now);
    const single = { done: 0, needed: 1, period: null };
    expect(list.statuses).toMatchObject({
      'due today': { ...single, dueInDays: 0 },
      overdue: { ...single, dueInDays: -2 },
      never: { ...single, dueInDays: null },
    });

    const everyTenDays = habit('soon', { type: 'everyNDays', days: 10 }, loggedOn('2026-09-25T09:00:00Z'));
    const soon = buildDueList([], [everyTenDays], {}, user, now);
    expect(ids(soon.upcomingHabits.map(u => u.item))).toEqual(['soon']);
    expect(soon.statuses).toEqual({ soon: { done: 0, needed: 1, period: null, dueInDays: 2 } });
  });

  it('uses a habit\'s latest entry when it\'s older than its recent entries reach', () => {
    const everySixtyDays = habit('dentist floss', { type: 'everyNDays', days: 60 });
    const longAgo = new Date('2026-08-20T09:00:00Z');
    expect(ids(buildDueList([], [everySixtyDays], {}, user, now).dueHabits)).toEqual(['dentist floss']);
    expect(ids(buildDueList([], [everySixtyDays], { 'dentist floss': longAgo }, user, now).doneHabits)).toEqual(['dentist floss']);
  });

  it('doesn\'t count the latest entry twice when it\'s already among the recent ones', () => {
    const twiceADay = habit('water', { type: 'daily', timesPerDay: 2 }, [{ createdAt: today, userId: 'me' }]);
    expect(ids(buildDueList([], [twiceADay], { water: today }, user, now).dueHabits)).toEqual(['water']);
  });

  it('lists every-N-days habits and categories due again soon as upcoming, with how soon', () => {
    const elevenDaysAgo = [{ createdAt: new Date('2026-09-22T09:00:00Z'), userId: 'me' }];
    const everyFourteenDays: Cadence = { type: 'everyNDays', days: 14 };
    const list = buildDueList(
      [category('Health', everyFourteenDays, [habit('blood pressure', everyFourteenDays, elevenDaysAgo)])],
      [], {}, user, now,
    );
    expect(list.upcomingHabits.map(u => [u.item.id, u.dueInDays])).toEqual([['blood pressure', 3]]);
    expect(list.upcomingCategories.map(u => [u.item.id, u.dueInDays])).toEqual([['Health', 3]]);
    expect(list.dueHabits).toEqual([]);
    expect(list.doneHabits).toEqual([]);
  });

  it('lists weekly and monthly habits and categories not done yet as upcoming until their last days', () => {
    const weekly: Cadence = { type: 'calendarWeek' };
    const monthly: Cadence = { type: 'calendarMonth' };
    const wednesday = new Date('2026-09-30T15:00:00Z');
    const list = buildDueList([category('Chores', weekly, [habit('vacuum', weekly), habit('budget', monthly)])], [], {}, user, wednesday);
    expect(list.upcomingHabits.map(u => [u.item.id, u.dueInDays])).toEqual([['vacuum', 3]]);
    // The last day of September
    expect(ids(list.dueHabits)).toEqual(['budget']);
    expect(list.upcomingCategories.map(u => [u.item.id, u.dueInDays])).toEqual([['Chores', 3]]);
    // Counting down to Saturday
    expect(list.statuses.vacuum).toMatchObject({ done: 0, needed: 1, period: null, dueInDays: 3 });

    // Saturday is the week's last day
    const saturday = buildDueList([category('Chores', weekly, [habit('vacuum', weekly)])], [], {}, user, now);
    expect(ids(saturday.dueHabits)).toEqual(['vacuum']);
    expect(ids(saturday.dueCategories)).toEqual(['Chores']);
  });
});

describe('clearedToday', () => {
  const yesterday = new Date('2026-10-02T09:00:00Z');
  const cleared = (habits: HabitListItem[], categories: CategoryTree[] = []) => buildDueList(categories, habits, {}, user, now).clearedToday;
  const loggedAt = (...dates: Date[]) => dates.map(createdAt => ({ createdAt, userId: 'me' }));

  it('is set once something due at the start of today has been done', () => {
    expect(cleared([habit('run', daily, loggedAt(today))])).toBe(true);
    // Saturday is a weekly habit's last day
    expect(cleared([habit('vacuum', { type: 'calendarWeek' }, loggedAt(today))])).toBe(true);
    expect(cleared([], [category('Fitness', daily, [habit('bike', none, loggedAt(today))])])).toBe(true);
  });

  it('isn\'t set when nothing was due today, even with entries today', () => {
    // A monthly habit with weeks to spare, done early
    expect(cleared([habit('budget', { type: 'calendarMonth' }, loggedAt(today))])).toBe(false);
    // An every-N-days habit still covered by yesterday's entry, done again today
    expect(cleared([habit('water plants', { type: 'everyNDays', days: 3 }, loggedAt(yesterday, today))])).toBe(false);
    expect(cleared([habit('run', daily)])).toBe(false);
  });

  it('is set alongside whatever is still due', () => {
    const list = buildDueList([], [habit('run', daily, loggedAt(today)), habit('stretch', daily)], {}, user, now);
    expect(list.clearedToday).toBe(true);
    expect(ids(list.dueHabits)).toEqual(['stretch']);
  });
});

describe('listRowStatus', () => {
  const at = (iso: string) => new Date(iso);
  const yesterday = at('2026-10-02T09:00:00Z');

  it('checks a habit with a cadence once it\'s met, and leaves it unchecked before', () => {
    expect(listRowStatus(daily, [today], user, { habit: true }, now)).toEqual({ done: 1, needed: 1, period: null, dueInDays: null });
    expect(listRowStatus(daily, [yesterday], user, { habit: true }, now)).toEqual({ done: 0, needed: 1, period: null, dueInDays: null });
  });

  it('counts toward a cadence that takes several entries, up to done', () => {
    const thriceDaily: Cadence = { type: 'daily', timesPerDay: 3 };
    expect(listRowStatus(thriceDaily, [today], user, { habit: true }, now)).toMatchObject({ done: 1, needed: 3 });
    expect(listRowStatus(thriceDaily, [today, today, today], user, { habit: true }, now)).toMatchObject({ done: 3, needed: 3 });
  });

  it('keeps an every-N-days habit checked until it\'s due again, even when due soon', () => {
    const everyTenDays: Cadence = { type: 'everyNDays', days: 10 };
    // Done 8 days ago: due in 2 days, the stretch the Agenda calls upcoming
    expect(listRowStatus(everyTenDays, [at('2026-09-25T09:00:00Z')], user, { habit: true }, now)).toEqual({ done: 1, needed: 1, period: null, dueInDays: 2 });
    expect(listRowStatus(everyTenDays, [at('2026-09-20T09:00:00Z')], user, { habit: true }, now)).toMatchObject({ done: 0, dueInDays: -3 });
  });

  it('gives the days left in the week or month for a weekly or monthly habit until it\'s done', () => {
    const wednesday = at('2026-09-30T15:00:00Z');
    const thriceWeekly: Cadence = { type: 'calendarWeek', times: 3 };
    expect(listRowStatus(thriceWeekly, [at('2026-09-28T09:00:00Z')], user, { habit: true }, wednesday)).toEqual({ done: 1, needed: 3, period: 'weekly', dueInDays: 3 });
    expect(listRowStatus({ type: 'calendarMonth' }, [], user, { habit: true }, now)).toMatchObject({ done: 0, dueInDays: 28 });
    expect(listRowStatus({ type: 'calendarWeek' }, [at('2026-09-28T09:00:00Z')], user, { habit: true }, wednesday)).toMatchObject({ done: 1, dueInDays: null });
  });

  it('checks a habit with no cadence once it has an entry today', () => {
    expect(listRowStatus(none, [today], user, { habit: true }, now)).toMatchObject({ done: 1, needed: 1 });
    expect(listRowStatus(none, [yesterday], user, { habit: true }, now)).toMatchObject({ done: 0, needed: 1 });
  });

  it('never checks a category with no cadence', () => {
    expect(listRowStatus(none, [today], user, { habit: false }, now)).toEqual({ done: 0, needed: 0, period: null, dueInDays: null });
  });
});

describe('skips on the Agenda', () => {
  const skipped = (h: HabitListItem, ...days: string[]): HabitListItem => ({ ...h, skips: days.map(day => ({ day })) });

  it('puts a habit skipped today with the done ones, marked as skipped, without earning the cleared reward', () => {
    const list = buildDueList([], [skipped(habit('run', daily), '2026-10-03'), habit('stretch', daily)], {}, user, now);
    expect(ids(list.dueHabits)).toEqual(['stretch']);
    expect(ids(list.doneHabits)).toEqual(['run']);
    expect(list.skippedHabitIds).toEqual(['run']);
    expect(list.clearedToday).toBe(false);
  });

  it('puts an every-N-days habit skipped today in Upcoming, counting down to when the skip runs out, with nothing more to skip', () => {
    const list = buildDueList([], [skipped(habit('floss', { type: 'everyNDays', days: 10 }), '2026-10-03')], {}, user, now);
    expect(list.upcomingHabits.map(u => [u.item.id, u.dueInDays])).toEqual([['floss', 2]]);
    expect(list.statuses.floss).toEqual({ done: 0, needed: 1, period: null, dueInDays: 2 });
    expect(list.skippedHabitIds).toEqual([]);
    expect(list.clearedToday).toBe(false);
  });

  it('doesn\'t mark a habit done by an entry as skipped', () => {
    const list = buildDueList([], [habit('run', daily, [{ createdAt: today, userId: 'me' }])], {}, user, now);
    expect(list.skippedHabitIds).toEqual([]);
    expect(list.clearedToday).toBe(true);
  });

  it('says what a skip is called for a due or upcoming habit that can be skipped, for swiping it away', () => {
    const wednesday = new Date('2026-09-30T15:00:00Z');
    const list = buildDueList([], [
      habit('run', daily),
      habit('vacuum', { type: 'calendarWeek', times: 2 }),
      // A day off: upcoming, but nothing to skip today
      habit('gym', { type: 'weekdays', days: [1, 5] }),
    ], {}, user, wednesday);
    expect(list.statuses.run.skip).toEqual({ skip: 'Skip today', skipped: 'Skipped today', postpones: false });
    expect(list.statuses.vacuum.skip).toEqual({ skip: 'Skip this week', skipped: 'Skipped this week', postpones: false });
    expect(list.statuses.gym.skip).toBeUndefined();
  });

  it('skips a category by its own cadence, leaving its habits as they are', () => {
    const thriceWeekly: Cadence = { type: 'calendarWeek', times: 3 };
    const fitness = { ...category('Fitness', thriceWeekly, [habit('run', daily)]), skips: [{ day: '2026-09-29' }] };
    const list = buildDueList([fitness], [], {}, user, now);
    expect(ids(list.doneCategories)).toEqual(['Fitness']);
    expect(list.skippedCategoryIds).toEqual(['Fitness']);
    // Its habit is still due: the category's skip isn't the habit's
    expect(ids(list.dueHabits)).toEqual(['run']);
    expect(list.clearedToday).toBe(false);
  });

  it('says what a category\'s skip is called while it can be skipped, and doesn\'t count its habits\' skips', () => {
    const fitness = category('Fitness', daily, [skipped(habit('run', none), '2026-10-03')]);
    const list = buildDueList([fitness], [], {}, user, now);
    expect(ids(list.dueCategories)).toEqual(['Fitness']);
    expect(list.dueCategories[0].status?.skip).toEqual({ skip: 'Skip today', skipped: 'Skipped today', postpones: false });
  });

  it('puts an every-N-days category that\'s postponed in Upcoming', () => {
    const plants = { ...category('Plants', { type: 'everyNDays', days: 10 }, [habit('water', none)]), skips: [{ day: '2026-10-03' }] };
    const list = buildDueList([plants], [], {}, user, now);
    expect(list.upcomingCategories.map(u => [u.item.id, u.dueInDays])).toEqual([['Plants', 2]]);
    expect(list.upcomingCategories[0].item.skippedDays).toEqual(['2026-10-03']);
  });

  it('says how consistently a row\'s been kept up on the Habits pages, given when it was created', () => {
    const created = new Date('2026-08-01T09:00:00Z');
    const everyDay = Array.from({ length: 70 }, (_, i) => new Date(Date.UTC(2026, 9, 2 - i, 9)));
    expect(listRowStatus(daily, everyDay, user, { habit: true, createdAt: created }, now).consistency).toEqual({ level: 'thriving', score: 1, trend: null });
    // Nothing's expected of one with no cadence, so it has none
    expect(listRowStatus(none, everyDay, user, { habit: true, createdAt: created }, now).consistency).toBeNull();
    // Not without when it was created (e.g. the Agenda, which doesn't show it)
    expect(listRowStatus(daily, everyDay, user, { habit: true }, now).consistency).toBeUndefined();
  });

  it('counts a category\'s skips in its row\'s status on the Habits pages', () => {
    expect(listRowStatus(daily, [], user, { habit: false, skippedDays: ['2026-10-03'] }, now)).toEqual({ done: 1, needed: 1, period: null, dueInDays: null });
  });

  it('counts skips in a habit row\'s status on the Habits pages', () => {
    expect(listRowStatus(daily, [], user, { habit: true, skippedDays: ['2026-10-03'] }, now)).toEqual({ done: 1, needed: 1, period: null, dueInDays: null });
    expect(listRowStatus(daily, [], user, { habit: true }, now)).toEqual({ done: 0, needed: 1, period: null, dueInDays: null });
    // An every-N-days habit put off by a skip isn't done, while one done by an entry is
    const everyTenDays: Cadence = { type: 'everyNDays', days: 10 };
    expect(listRowStatus(everyTenDays, [], user, { habit: true, skippedDays: ['2026-10-03'] }, now)).toEqual({ done: 0, needed: 1, period: null, dueInDays: 2 });
    expect(listRowStatus(everyTenDays, [new Date('2026-09-25T09:00:00Z')], user, { habit: true }, now)).toEqual({ done: 1, needed: 1, period: null, dueInDays: 2 });
  });
});
