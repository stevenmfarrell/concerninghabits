export const UNCATEGORIZED_ID = 'uncategorized';
export const UNCATEGORIZED_ICON = 'Inbox';
// What a category with no icon of its own shows, everywhere. Left unset in the database, rather than
// saved into it, so changing this changes them all.
export const DEFAULT_CATEGORY_ICON = 'Folder';
export const MIN_PASSWORD_LENGTH = 8;
// The longest activity-heatmap horizon offered (HorizonToggle's "1Y"), in weeks.
export const MAX_HISTORY_WEEKS = 52;
// Upper bound on rows accepted by a single CSV log import, to keep one request's batch insert bounded.
export const MAX_CSV_IMPORT_ROWS = 5000;
// Largest entry (its values as stored JSON, in UTF-8 bytes) a log can hold, since whole entries are
// loaded with a habit's history and sent to the browser. About 650 words of plain English.
export const MAX_LOG_PAYLOAD_BYTES = 4096;
// Longest per-habit "context for AI" a user can save (see HabitMember.aiContext), since it's sent
// with every AI request for that habit.
export const MAX_AI_CONTEXT_LENGTH = 1000;
// Longest name for a habit, a category, or a form field; descriptions can run longer. Names show on
// every list row and go into AI prompts.
export const MAX_NAME_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 1000;
// Longest bcrypt reads of a password, in UTF-8 bytes. Anything after is silently ignored, so longer
// ones are refused instead of quietly only partly counting.
export const MAX_PASSWORD_BYTES = 72;
// Longest request typed or said to the AI (a habit to set up, an entry, a chart), and how many AI
// requests a user can make in an hour, since each one costs.
export const MAX_AI_INPUT_LENGTH = 2000;
export const MAX_AI_REQUESTS_PER_HOUR = 100;
// Where the app's source code is, linked from Settings. The AGPL asks anyone running a modified
// version for others to offer them its source, so a fork that's run that way should point this at
// its own.
export const SOURCE_CODE_URL = 'https://github.com/stevenmfarrell/concerninghabits';

// Habits placed in a list without a chosen position (new, newly shared, or moved to another
// category) go to the end of it.
export const END_OF_LIST_ORDER = 9999;
