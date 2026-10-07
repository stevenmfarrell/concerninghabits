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
    expect(list.statuses).toEqual({
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
    expect(list.dueCategories).toMatchObject([{ id: 'Music', status: { done: 2, needed: 3, period: 'weekly', dueInDays: null } }]);
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
    expect(list.statuses).toEqual({
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

  it('checks a habit with no cadence once it has an entry today', () => {
    expect(listRowStatus(none, [today], user, { habit: true }, now)).toMatchObject({ done: 1, needed: 1 });
    expect(listRowStatus(none, [yesterday], user, { habit: true }, now)).toMatchObject({ done: 0, needed: 1 });
  });

  it('never checks a category with no cadence', () => {
    expect(listRowStatus(none, [today], user, { habit: false }, now)).toEqual({ done: 0, needed: 0, period: null, dueInDays: null });
  });
});
