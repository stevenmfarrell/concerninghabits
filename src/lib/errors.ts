// The user doesn't have what they asked for: it isn't theirs, isn't shared with them, or is gone (the
// two look the same, so nothing reveals what exists). Callers that treat it differently from other
// failures, like offline sync, check for this class rather than the message, which is free to change.
export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

// For `.catch()` on an access check: null when the user doesn't have it, and anything else (the
// database failing) thrown on, so it isn't mistaken for the thing not being there
export function nullIfUnauthorized(error: unknown): null {
  if (error instanceof UnauthorizedError) return null;
  throw error;
}
