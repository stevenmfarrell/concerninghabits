import { z } from 'zod';
import { encodeCsv, parseCsv } from './csv';

// A backup of one user's data, to download from Settings → Backup and restore later: their
// preferences, categories, the habits they own (with forms, calculated fields, charts and
// cadences, and where they've filed each), their own entries on those habits, skips and
// vacations. Habits shared with them belong to their owners, so they aren't in it.
//
// It comes as JSON, or as one CSV with a row per record (see toCsv), and restores from either.
// Ids are kept, so restoring a backup again (or into the account it came from) skips what's
// already there rather than duplicating it.
export const BACKUP_FORMAT = 'concerning-habits-backup';
export const BACKUP_VERSION = 1;

const id = z.string().min(1).max(100);
const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be YYYY-MM-DD');
const timestamp = z.string().refine(value => !Number.isNaN(new Date(value).getTime()), 'Not a valid date and time');

// What's in a backup. Values the app checks with its own rules (a habit's form, cadence,
// calculated fields and charts, an entry's values, the preferences) are checked by those rules on
// restore, not here.
export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: timestamp,
  preferences: z.record(z.string(), z.unknown()).default({}),
  categories: z.array(z.object({
    id,
    name: z.string(),
    icon: z.string().nullable(),
    parentId: id.nullable(),
    order: z.number().int(),
    cadence: z.unknown(),
  })).default([]),
  habits: z.array(z.object({
    id,
    name: z.string(),
    description: z.string().nullable(),
    schema: z.unknown(),
    cadence: z.unknown(),
    calculatedFields: z.unknown(),
    charts: z.unknown(),
    publishToMqtt: z.boolean(),
    createdAt: timestamp,
    // The owner's own filing of it, notes for the AI, and reminder
    categoryId: id.nullable(),
    order: z.number().int(),
    aiContext: z.string().nullable(),
    remind: z.boolean(),
    remindAt: z.string().nullable(),
  })).default([]),
  entries: z.array(z.object({ id, habitId: id, createdAt: timestamp, values: z.record(z.string(), z.unknown()) })).default([]),
  habitSkips: z.array(z.object({ habitId: id, day: dayKey })).default([]),
  categorySkips: z.array(z.object({ categoryId: id, day: dayKey })).default([]),
  vacations: z.array(z.object({ from: dayKey, to: dayKey.nullable() })).default([]),
});

export type Backup = z.infer<typeof backupSchema>;
export type BackupFormat = 'json' | 'csv';

// The most a backup file may be, as text
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export function toJson(backup: Backup) {
  return JSON.stringify(backup, null, 2);
}

// The CSV's columns: what a row is, its id, what it belongs to (a category's parent, a habit's
// category, an entry's or skip's habit, a category skip's category), its name, its date (when a
// habit was made or an entry logged, a skip's day, a vacation's start), and the rest as JSON
const CSV_COLUMNS = ['record', 'id', 'parent', 'name', 'date', 'data'] as const;

export function toCsv(backup: Backup) {
  const row = (record: string, fields: { id?: string; parent?: string | null; name?: string; date?: string; data?: unknown }) =>
    [record, fields.id ?? '', fields.parent ?? '', fields.name ?? '', fields.date ?? '', fields.data === undefined ? '' : JSON.stringify(fields.data)];
  return encodeCsv([
    [...CSV_COLUMNS],
    row('backup', { name: backup.format, date: backup.exportedAt, data: { version: backup.version } }),
    row('preferences', { data: backup.preferences }),
    ...backup.categories.map(({ id, name, parentId, ...data }) => row('category', { id, parent: parentId, name, data })),
    ...backup.habits.map(({ id, name, categoryId, createdAt, ...data }) => row('habit', { id, parent: categoryId, name, date: createdAt, data })),
    ...backup.entries.map(({ id, habitId, createdAt, values }) => row('entry', { id, parent: habitId, date: createdAt, data: values })),
    ...backup.habitSkips.map(({ habitId, day }) => row('habitSkip', { parent: habitId, date: day })),
    ...backup.categorySkips.map(({ categoryId, day }) => row('categorySkip', { parent: categoryId, date: day })),
    ...backup.vacations.map(({ from, to }) => row('vacation', { date: from, data: { to } })),
  ]) + '\r\n';
}

// A backup's fields from its CSV, unchecked (see parseBackup), or why it can't be read
function fromCsv(text: string): { value: unknown } | { problem: string } {
  const [header, ...rows] = parseCsv(text);
  if (!header || CSV_COLUMNS.some((column, i) => header[i]?.trim() !== column)) return { problem: `This isn't a backup: its first row should be ${CSV_COLUMNS.join(',')}` };
  const value: Record<string, unknown> & { categories: unknown[]; habits: unknown[]; entries: unknown[]; habitSkips: unknown[]; categorySkips: unknown[]; vacations: unknown[] } =
    { categories: [], habits: [], entries: [], habitSkips: [], categorySkips: [], vacations: [] };
  for (const [i, cells] of rows.entries()) {
    const [record, rowId, parent, name, date, rawData] = cells.map(cell => cell ?? '');
    if (!record && cells.every(cell => !cell)) continue;
    let data: Record<string, unknown> = {};
    if (rawData) {
      try {
        const parsed: unknown = JSON.parse(rawData);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
      } catch {
        return { problem: `Row ${i + 2}: its data isn't valid JSON` };
      }
    }
    const nullable = (value: string) => (value === '' ? null : value);
    switch (record) {
      case 'backup': Object.assign(value, { format: name, exportedAt: date, ...data }); break;
      case 'preferences': value.preferences = data; break;
      case 'category': value.categories.push({ ...data, id: rowId, parentId: nullable(parent), name }); break;
      case 'habit': value.habits.push({ ...data, id: rowId, categoryId: nullable(parent), name, createdAt: date }); break;
      case 'entry': value.entries.push({ id: rowId, habitId: parent, createdAt: date, values: data }); break;
      case 'habitSkip': value.habitSkips.push({ habitId: parent, day: date }); break;
      case 'categorySkip': value.categorySkips.push({ categoryId: parent, day: date }); break;
      case 'vacation': value.vacations.push({ from: date, to: data.to ?? null }); break;
      default: return { problem: `Row ${i + 2}: "${record}" isn't something a backup has` };
    }
  }
  return { value };
}

// A backup from a file's text, JSON or CSV, checked; or why it can't be restored
export function parseBackup(text: string): { backup: Backup } | { problem: string } {
  const trimmed = text.replace(/^﻿/, '').trim();
  let value: unknown;
  if (trimmed.startsWith('{')) {
    try {
      value = JSON.parse(trimmed);
    } catch {
      return { problem: 'This file isn\'t valid JSON' };
    }
  } else {
    const csv = fromCsv(trimmed);
    if ('problem' in csv) return csv;
    value = csv.value;
  }
  const parsed = backupSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === 'format') return { problem: 'This isn\'t a Concerning Habits backup' };
    if (issue?.path[0] === 'version') return { problem: 'This backup is from a newer version of the app' };
    return { problem: `This backup isn't valid: ${issue?.path.join('.') || 'it'}: ${issue?.message ?? 'unexpected value'}` };
  }
  return { backup: parsed.data };
}
