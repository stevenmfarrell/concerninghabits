// A habit's page with `data` as prefill values in its address (see LogClient), to finish an entry
// there: the entry sheet opens with them filled in, ready to check and log
export function prefillHref(habitId: string, data: Record<string, unknown> = {}) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') params.set(key, String(val));
  }
  return params.size ? `/log/${habitId}?${params}` : `/log/${habitId}`;
}
