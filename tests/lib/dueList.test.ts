import { describe, expect, it } from 'vitest';
import { buildDueList, type CategoryTree } from '@/lib/dueList';
import type { HabitListItem } from '@/lib/types';
import type { Cadence } from '@/lib/cadence';

const user = { timeZone: 'UTC', bedtime: '00:00', weekStartsOn: 'sunday' };
// Saturday, October 3rd 2026, mid-afternoon
const now = new Date('2026-10-03T15:00:00Z');
const today = new Date('2026-10-03T09:00:00Z');

function habit(id: string, cadence: Cadence, logs: { createdAt: Date; userId: string }[] = []): HabitListItem {
  return { id, name: id, schema: '{}', cadence: JSON.stringify(cadence), userId: 'me', logs };
}

function category(id: string, cadence: Cadence, habits: HabitListItem[], children: CategoryTree['children'] = []): CategoryTree {
  return { id, name: id, icon: null, cadence: JSON.stringify(cadence), habits, children };
}

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

  it('lists a due subcategory with its parent\'s name, and only its own habits', () => {
    const cardio = category('Cardio', daily, [habit('bike', none)]);
    const list = buildDueList([category('Fitness', none, [habit('pushups', none)], [cardio])], [], {}, user, now);
    expect(list.dueCategories).toMatchObject([{ id: 'Cardio', parentName: 'Fitness' }]);
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
    expect(list.progress).toEqual({ water: { done: 2, needed: 4 } });
  });

  it('leaves out the progress of a habit once it\'s done', () => {
    const water = habit('water', { type: 'daily', timesPerDay: 2 }, [today, today].map(createdAt => ({ createdAt, userId: 'me' })));
    expect(buildDueList([], [water], {}, user, now).progress).toEqual({});
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
