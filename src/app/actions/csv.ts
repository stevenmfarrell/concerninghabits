'use server';

import { prisma } from '@/lib/prisma';
import { MAX_CSV_IMPORT_ROWS } from '@/lib/constants';
import { parseEntryValues, parseHabitSchema } from '@/lib/habitSchema';
import { encodeCsv, parseCsv } from '@/lib/csv';
import { fieldsOf } from '@/lib/formFields';
import { revalidateEntries, getMembership, payloadSizeProblem } from './internal';
import { getDefaultUser } from './user';

export async function exportHabitLogsCsv(habitId: string) {
  const user = await getDefaultUser();
  const { habit } = await getMembership(user.id, habitId);
  const properties = fieldsOf(parseHabitSchema(habit.schema));
  const fieldKeys = Object.keys(properties);

  const logs = await prisma.habitLog.findMany({
    where: { habitId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { name: true } } }
  });

  // Name who logged each entry once more than one person has. Import ignores this column, since
  // it matches no form field.
  const includeLoggedBy = new Set(logs.map(log => log.userId)).size > 1;

  const header = ['Date', ...fieldKeys.map(key => properties[key].title || key), ...(includeLoggedBy ? ['Logged By'] : [])];
  const rows = logs.map(log => {
    const payload = parseEntryValues(log.payload) ?? {};
    return [
      log.createdAt.toISOString(),
      ...fieldKeys.map(key => {
        const val = payload[key];
        return val === undefined || val === null ? '' : String(val);
      }),
      ...(includeLoggedBy ? [log.user.name] : [])
    ];
  });

  const safeName = habit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'habit';
  return { filename: `${safeName}-log.csv`, csv: encodeCsv([header, ...rows]) };
}

export async function importHabitLogsCsv(habitId: string, csvText: string) {
  const user = await getDefaultUser();
  const { habit } = await getMembership(user.id, habitId);
  const properties = fieldsOf(parseHabitSchema(habit.schema));

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { imported: 0, skipped: 0, errors: ['The CSV file is empty.'] };
  }

  const [header, ...dataRows] = rows;
  if (dataRows.length > MAX_CSV_IMPORT_ROWS) {
    throw new Error(`CSV has too many rows (max ${MAX_CSV_IMPORT_ROWS}).`);
  }

  // Match each non-date column to a schema field by header title or key, case-insensitively.
  const columnKeys: (string | null)[] = header.slice(1).map(col => {
    const normalized = col.trim().toLowerCase();
    return Object.keys(properties).find(key =>
      key.toLowerCase() === normalized || (properties[key].title || '').toLowerCase() === normalized
    ) || null;
  });

  const errors: string[] = [];
  const toCreate: { habitId: string; userId: string; payload: string; createdAt?: Date }[] = [];

  dataRows.forEach((row, i) => {
    const rowNum = i + 2; // +1 for 0-index, +1 for the header row
    const dateStr = row[0]?.trim();
    let createdAt: Date | undefined;
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        errors.push(`Row ${rowNum}: could not parse date "${dateStr}".`);
        return;
      }
      createdAt = parsed;
    }

    const payload: Record<string, unknown> = {};
    columnKeys.forEach((key, colIdx) => {
      if (!key) return;
      const raw = row[colIdx + 1]?.trim();
      if (!raw) return;

      const propType = properties[key].type;
      if (propType === 'number' || propType === 'integer') {
        const num = Number(raw);
        if (!isNaN(num)) payload[key] = num;
      } else if (propType === 'boolean') {
        payload[key] = raw.toLowerCase() === 'true' || raw === '1';
      } else {
        payload[key] = raw;
      }
    });

    const sizeProblem = payloadSizeProblem(payload);
    if (sizeProblem) {
      errors.push(`Row ${rowNum}: ${sizeProblem}.`);
      return;
    }

    toCreate.push({
      habitId,
      userId: user.id,
      payload: JSON.stringify(payload),
      ...(createdAt ? { createdAt } : {})
    });
  });

  if (toCreate.length > 0) {
    await prisma.habitLog.createMany({ data: toCreate });
  }

  revalidateEntries(habitId);

  return { imported: toCreate.length, skipped: dataRows.length - toCreate.length, errors };
}
