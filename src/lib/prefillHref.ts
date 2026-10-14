// The address parameter for when an entry was done, if not now (see LogClient)
export const LOGGED_AT_PARAM = 'loggedAt';

// A habit's page with `data` as prefill values in its address (see LogClient), to finish an entry
// there: the entry sheet opens with them filled in, ready to check and log, and with `loggedAt` as
// its custom date when given
export function prefillHref(habitId: string, data: Record<string, unknown> = {}, loggedAt?: Date) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') params.set(key, String(val));
  }
  if (loggedAt) params.set(LOGGED_AT_PARAM, loggedAt.toISOString());
  return params.size ? `/log/${habitId}?${params}` : `/log/${habitId}`;
}
