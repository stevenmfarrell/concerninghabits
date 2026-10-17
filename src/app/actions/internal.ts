// Helpers the server actions share: refreshing pages after a change, and checks on what's saved. Not
// actions themselves (a 'use server' file may only export async functions), so only ever imported by
// server code. What the actions do for the signed-in user lives in src/lib, for a given user, so the
// API can do the same (see entries.ts, skips.ts, habitLists.ts, agenda.ts, habitDetails.ts).

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { END_OF_LIST_ORDER } from '@/lib/constants';
import { cadenceSchema, type Cadence } from '@/lib/cadence';
import type { HabitSchema } from '@/lib/types';
import { calculatedFieldsSchema, type CalculatedField } from '@/lib/calculatedFields';
import { fieldsOf } from '@/lib/formFields';
import { getMembership, getOwnedCategory } from '@/lib/access';
import type { Skippable } from '@/lib/skips';

// The Agenda page and the Habits page both list habits with their recent entries, so anything that
// changes a habit, a category, or an entry refreshes both
export function revalidateLists() {
  revalidatePath('/');
  revalidatePath('/habits');
}

// After a habit's entries change: its page, the lists, and the History view
export function revalidateEntries(habitId: string) {
  revalidatePath(`/log/${habitId}`);
  revalidateLists();
  revalidatePath('/history');
}

// After something's skipped or unskipped: the lists, and its page
export function revalidateSkip(target: Skippable) {
  revalidateLists();
  revalidatePath(target.kind === 'habit' ? `/log/${target.id}` : `/categories/${target.id}`);
}

// A cadence as it's stored (Habit.cadence, Category.cadence), checked here as well as typed, since
// it comes from the browser
export function cadenceJson(cadence: Cadence) {
  return JSON.stringify(cadenceSchema.parse(cadence));
}

// Categories nest one level deep: a parent must be a top-level category, and a category
// that has subcategories can't itself be nested. This also rules out parent cycles.
// This is the authority on that rule — computeDrop/applyDrop in categoryDrop.ts encode the same
// constraint client-side (for the live drag preview) and must stay consistent with it.
export async function assertValidParent(userId: string, parentId: string, categoryId?: string) {
  if (parentId === categoryId) throw new Error("A category can't be its own parent");
  const parent = await getOwnedCategory(userId, parentId);
  if (parent.parentId) throw new Error("Subcategories can't have subcategories");
  if (categoryId && await prisma.category.count({ where: { parentId: categoryId } }) > 0) {
    throw new Error("A category with subcategories can't be nested");
  }
}

// Files a habit into one of the user's categories (or Uncategorized when null), moving it to the
// end of that list if it's changing lists.
export async function fileHabit(userId: string, habitId: string, categoryId: string | null) {
  const membership = await getMembership(userId, habitId);
  const change = filingChange(membership.categoryId, categoryId);
  if (!change) return;
  await prisma.habitMember.update({ where: { habitId_userId: { habitId, userId } }, data: change });
}

// What filing a membership now in `current` into `categoryId` changes about it (see fileHabit), or
// null when it's already there
export function filingChange(current: string | null, categoryId: string | null) {
  return current === categoryId ? null : { categoryId, order: END_OF_LIST_ORDER };
}

// A habit's calculated fields as saved with its form, checked here as well as typed since they come
// from the browser. One whose formula uses a field the form no longer has is kept (the editor shows
// it as needing fixing, and charts leave it out), but a key can't clash with a form field's.
export function checkCalculatedFields(fields: CalculatedField[], schema: HabitSchema) {
  const checked = calculatedFieldsSchema.parse(fields);
  const formKeys = Object.keys(fieldsOf(schema));
  const clash = checked.find(field => formKeys.includes(field.key));
  if (clash) throw new Error(`"${clash.title}" has the same key as a form field`);
  return checked;
}
