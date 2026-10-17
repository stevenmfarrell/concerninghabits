import { z } from 'zod';
import { MAX_AI_INPUT_LENGTH } from '../constants';

// A change made while offline (or while the connection was failing), kept in the browser's outbox
// (see outbox.ts) until it's sent to /api/sync. Each is applied by the server as the user would have
// made it online, and each can be sent more than once without happening twice: a new entry has an
// id made by the browser (`entryId`, see createHabitLog), and the rest are the same however many
// times they're applied (a skip, an edit, a deletion of something already gone).

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const isoTime = z.string().refine(value => !Number.isNaN(new Date(value).getTime()), 'Not a date and time');
const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const values = z.record(z.string(), z.unknown());
const target = z.object({ kind: z.enum(['habit', 'category']), id: z.string().min(1) });

const common = {
  opId: uuid,
  // Whose change it is: a device can be shared, and only the signed-in user's changes are sent
  userId: z.string().min(1),
};

export const opSchema = z.discriminatedUnion('kind', [
  // An entry, with its values
  z.object({ ...common, kind: z.literal('log'), entryId: uuid, habitId: z.string().min(1), values, createdAt: isoTime }),
  // Something said or typed, for AI to fill in an entry from on `habitId`, or with no habit, to match
  // to one of the user's habits first (as the Agenda's smart entry does)
  z.object({ ...common, kind: z.literal('text'), entryId: uuid, habitId: z.string().min(1).nullable(), text: z.string().trim().min(1).max(MAX_AI_INPUT_LENGTH), createdAt: isoTime }),
  // A change to an entry the server already has: its values, and its time when given
  z.object({ ...common, kind: z.literal('update'), entryId: z.string().min(1), habitId: z.string().min(1), values, createdAt: isoTime.optional() }),
  z.object({ ...common, kind: z.literal('delete'), entryId: z.string().min(1), habitId: z.string().min(1) }),
  // A habit or category skipped on `day`, or its skip taken back
  z.object({ ...common, kind: z.literal('skip'), target, day: dayKey }),
  z.object({ ...common, kind: z.literal('unskip'), target, day: dayKey }),
]);

export type Op = z.infer<typeof opSchema>;
export type OpKind = Op['kind'];

// The most changes sent to /api/sync at once
export const MAX_OPS_PER_SYNC = 50;

// What became of a change sent to /api/sync:
// - done: it's been made (or already had been)
// - failed: it can't be made as it is, e.g. the habit's gone or its form now needs a value the entry
//   doesn't have. It waits for the user to fix or discard it, with what's known for finishing it by
//   hand: the habit it was for and the values it had (or that AI could fill in).
// - retry: it couldn't be made this time, e.g. it's someone else's (another user signed in on this
//   device), or the sync ran out of time before reaching it, so it's kept as it is to send again
export type OpResult =
  | { opId: string; status: 'done' }
  | { opId: string; status: 'failed'; error: string; habitId?: string; values?: Record<string, unknown> }
  | { opId: string; status: 'retry'; error: string };
