// Shared types derived from the server actions' own return types, so they can't drift from the
// Prisma queries that produce them. Import with `import type` only — these erase at build time.
import type { RJSFSchema } from '@rjsf/utils';
import type {
  getDefaultUser,
  getCategories,
  getCategory,
  getHabit,
  getHabitLogs,
} from '@/app/actions/db';

// A habit's form definition: an RJSF (draft-07) JSON schema plus this app's own extensions.
export type HabitSchema = RJSFSchema & {
  title?: string;
  targetCount?: number;
  enableVoice?: boolean;
  enablePhoto?: boolean;
};

export type SessionUser = Awaited<ReturnType<typeof getDefaultUser>>;
export type CategoryOption = Awaited<ReturnType<typeof getCategories>>[number];
export type CategoryDetail = NonNullable<Awaited<ReturnType<typeof getCategory>>>;
export type HabitDetail = NonNullable<Awaited<ReturnType<typeof getHabit>>>;
export type HabitWithLogs = HabitDetail & { logs: Awaited<ReturnType<typeof getHabitLogs>> };

// Minimal shapes for the habit/subcategory list rows shared by the dashboard and category pages.
// Kept structural (rather than tied to one query's exact `include`) since favorites, uncategorized
// habits, and a category's own habits all come from different queries with slightly different shapes.
export interface HabitListItem {
  id: string;
  name: string;
  schema: string;
  frequency: string;
  // The habit's owner
  userId: string;
  order?: number | null;
  logs?: { createdAt: Date; userId: string }[];
  // How many people have this habit (1 unless it's shared)
  memberCount?: number;
}

export interface SubcategoryListItem {
  id: string;
  name: string;
  icon: string | null;
  order?: number | null;
  habits?: HabitListItem[];
}
