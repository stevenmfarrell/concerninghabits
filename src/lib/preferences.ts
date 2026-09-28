import { z } from 'zod';

// The only user fields updateUserPreferences may change. Unknown keys (e.g. isAdmin, passwordHash)
// are stripped, so a client can't use the action to write other columns.
export const userPreferencesSchema = z.object({
  bedtime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Bedtime must be HH:MM').optional(),
  weekStartsOn: z.enum(['sunday', 'monday']).optional(),
  useEmojiTitle: z.boolean().optional(),
  unitSystem: z.enum(['imperial', 'metric']).optional(),
  emojiModifier: z.string().max(200).nullable().optional(),
});
