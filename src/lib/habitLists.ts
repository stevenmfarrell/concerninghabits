import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { NO_CADENCE, parseCadence, type Cadence } from './cadence';
import { DAY_MS } from './timezone';
import { healthHistoryDays } from './consistency';

// A user's habits as the lists show them (the Agenda, the Habits and category pages, History): by
// category, in their own order, with each habit's recent entries and skipped days. For a given
// user, so the web app and the API list the same. Server-only.

// A user's habits in one list (a category, uncategorized), in that user's saved order, with the
// days each was skipped. Their entries are loaded after (see loadListEntries), each back as far as
// it needs.
export const habitListRows = {
  orderBy: [{ order: 'asc' }, { habit: { name: 'asc' } }],
  include: {
    habit: {
      include: {
        // All of them, not just recent ones: there are few, and an every-N-days skip can count for months
        skips: { select: { day: true } },
        _count: { select: { members: true } },
      }
    }
  }
} satisfies Prisma.HabitMemberFindManyArgs;

export type HabitListMembership = Prisma.HabitMemberGetPayload<typeof habitListRows>;

// The days a category was skipped (see CategorySkip), all of them, as for a habit's
export const categorySkips = { select: { day: true } } as const;

// How far back a list loads its habits' entries: enough for its calendars and rings, `weeks` weeks,
// and with `health` (the Habits and category pages), as far back as each habit's health needs, and
// each category's it counts toward. That depends on the cadence: a daily habit's health looks back
// about three months, a monthly one's a year (see healthHistoryDays).
export interface ListHistory {
  weeks: number;
  health?: boolean;
}

// The earliest log time a calendar of `weeks` weeks (see ActivityCalendar) can need. A calendar
// never starts more than `weeks` weeks back, but a weekly or monthly habit's first cell is filled if
// the habit was done anytime in that week or month, even before the calendar starts. So snap to the
// 1st of the month, then keep a generous buffer: another whole month and week, which also covers
// week starts, the viewer's time zone vs. the server's, and bedtime (logs before bedtime count
// toward the previous day).
export function getRecentLogsCutoff(weeks: number, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - weeks * 7);
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  return cutoff;
}

// The first moment a habit's entries are needed from, for `history` and the cadences of the habit
// and the categories it counts toward. On a day boundary, so habits needing the same are loaded
// together.
export function historyCutoff({ weeks, health }: ListHistory, cadences: Cadence[], now: Date) {
  let cutoff = getRecentLogsCutoff(weeks, now);
  if (!health) return cutoff;
  for (const cadence of cadences) {
    if (cadence.type === 'none') continue;
    const needed = new Date(now.getTime() - healthHistoryDays(cadence) * DAY_MS);
    needed.setUTCHours(0, 0, 0, 0);
    if (needed < cutoff) cutoff = needed;
  }
  return cutoff;
}

// Each listed habit's cutoff (see historyCutoff), from its own cadence and those of the categories
// it counts toward (`cadences`, as stored)
export function listCutoffs(history: ListHistory, lists: { members: HabitListMembership[]; cadences: string[] }[], now = new Date()) {
  const cutoffs = new Map<string, Date>();
  for (const { members, cadences } of lists) {
    const categoryCadences = cadences.map(cadence => parseCadence(cadence, NO_CADENCE));
    for (const { habit } of members) cutoffs.set(habit.id, historyCutoff(history, [parseCadence(habit.cadence), ...categoryCadences], now));
  }
  return cutoffs;
}

// A list's entries: everyone's, not just the viewer's, since a shared habit's history is everyone
// on it's. `began` is when each habit's history began, for its health: when it was made, or its
// first entry if that's earlier (e.g. imported), which may be older than what's loaded.
export interface ListEntries {
  logs: Map<string, { createdAt: Date; userId: string }[]>;
  began: Map<string, Date>;
}

// Each habit's entries from its cutoff on (see historyCutoff), and with `health`, its first entry's
// time, in two queries for the whole list
export async function loadListEntries(cutoffs: Map<string, Date>, health = false): Promise<ListEntries> {
  const entries: ListEntries = { logs: new Map(), began: new Map() };
  if (cutoffs.size === 0) return entries;
  const groups = new Map<number, string[]>();
  for (const [habitId, cutoff] of cutoffs) groups.set(cutoff.getTime(), [...(groups.get(cutoff.getTime()) ?? []), habitId]);
  const [logs, firsts] = await Promise.all([
    prisma.habitLog.findMany({
      where: { OR: [...groups].map(([cutoff, habitIds]) => ({ habitId: { in: habitIds }, createdAt: { gte: new Date(cutoff) } })) },
      select: { habitId: true, createdAt: true, userId: true },
    }),
    health ? prisma.habitLog.groupBy({ by: ['habitId'], where: { habitId: { in: [...cutoffs.keys()] } }, _min: { createdAt: true } }) : [],
  ]);
  for (const { habitId, createdAt, userId } of logs) entries.logs.set(habitId, [...(entries.logs.get(habitId) ?? []), { createdAt, userId }]);
  for (const { habitId, _min } of firsts) if (_min.createdAt) entries.began.set(habitId, _min.createdAt);
  return entries;
}

// Flatten a membership onto its habit, so list rows read the viewer's own order and category the
// same way whether the habit is theirs or shared with them, with its entries from `entries`
export function toHabitListItem({ habit, order, categoryId, aiContext }: HabitListMembership, entries: ListEntries) {
  const firstEntry = entries.began.get(habit.id);
  return {
    ...habit,
    order,
    categoryId,
    aiContext,
    memberCount: habit._count.members,
    logs: entries.logs.get(habit.id) ?? [],
    began: firstEntry && firstEntry < habit.createdAt ? firstEntry : habit.createdAt,
  };
}

export function withHabits<C extends { habitMembers: HabitListMembership[] }>({ habitMembers, ...category }: C, entries: ListEntries) {
  return { ...category, habits: habitMembers.map(membership => toHabitListItem(membership, entries)) };
}

// The user's top-level categories, each with its subcategories, and each with its habits (see
// habitListRows). A subcategory's habits count toward its parent too. `weeks` bounds how far back
// entries are loaded: enough for the 4-week row calendars by default, or more for a caller that
// looks further back. With `health` (the Habits page), each habit's go back as far as its health
// needs, and its categories' (see ListHistory).
export async function categoriesWithHierarchyOf(userId: string, weeks = 5, health = false) {
  const categories = await prisma.category.findMany({
    where: { userId, parentId: null },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      children: {
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: { habitMembers: habitListRows, skips: categorySkips }
      },
      habitMembers: habitListRows,
      skips: categorySkips
    }
  });
  const cutoffs = listCutoffs({ weeks, health }, categories.flatMap(category => [
    { members: category.habitMembers, cadences: [category.cadence] },
    ...category.children.map(child => ({ members: child.habitMembers, cadences: [child.cadence, category.cadence] })),
  ]));
  const entries = await loadListEntries(cutoffs, health);
  return categories.map(category => ({ ...withHabits(category, entries), children: category.children.map(child => withHabits(child, entries)) }));
}

// The user's habits in no category of theirs, including habits newly shared with them, until they
// file them into one. `weeks` and `health` as for categoriesWithHierarchyOf.
export async function uncategorizedHabitsOf(userId: string, weeks: number, health = false) {
  const memberships = await prisma.habitMember.findMany({
    where: { userId, categoryId: null },
    ...habitListRows,
  });
  const entries = await loadListEntries(listCutoffs({ weeks, health }, [{ members: memberships, cadences: [] }]), health);
  return memberships.map(membership => toHabitListItem(membership, entries));
}

// When each of the user's habits was last logged, by anyone. List rows only carry the last few
// weeks of entries, but an every-N-days habit can still be done by an entry older than that.
export async function latestLogDatesOf(userId: string): Promise<Record<string, Date>> {
  const latest = await prisma.habitLog.groupBy({
    by: ['habitId'],
    where: { habit: { members: { some: { userId } } } },
    _max: { createdAt: true },
  });
  return Object.fromEntries(latest.flatMap(l => (l._max.createdAt ? [[l.habitId, l._max.createdAt]] : [])));
}
