export const UNCATEGORIZED_ID = 'uncategorized';
export const UNCATEGORIZED_ICON = 'Inbox';
export const MIN_PASSWORD_LENGTH = 8;
// How many times a "multiple per day" habit is expected to be logged, until the habit's own
// schema.targetCount overrides it.
export const DEFAULT_TARGET_COUNT = 3;
// The longest activity-heatmap horizon offered (HorizonToggle's "1Y"), in weeks.
export const MAX_HISTORY_WEEKS = 52;
// Upper bound on rows accepted by a single CSV log import, to keep one request's batch insert bounded.
export const MAX_CSV_IMPORT_ROWS = 5000;
// sessionStorage key for something the user said on the dashboard that was matched to a habit,
// handed to that habit's log page to fill in and submit: `{ habitId, transcript }`.
export const PENDING_VOICE_LOG_KEY = 'pendingVoiceLog';
