// Carries the page a logged-out visitor asked for through login, so a link like a habit's submit
// URL (/log/<id>?...&submit=1) still does its job once they've signed in.

export const RETURN_TO_PARAM = 'next';
// Set by the proxy on every request so server code that bounces a stale session to login knows
// which page was being loaded (server components have no other access to the request URL).
export const RETURN_TO_HEADER = 'x-return-to';

const NO_RETURN_PATHS = ['/login', '/setup', '/api/logout'];

// Only same-origin paths are allowed back through, so a crafted /login?next=https://evil.example
// link can't turn our login form into an open redirect. `//host` and `/\host` are rejected too,
// since browsers treat both as protocol-relative URLs to another site.
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  const base = 'http://return-to.invalid';
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return null;
  }
  if (url.origin !== base || NO_RETURN_PATHS.includes(url.pathname)) return null;
  const path = url.pathname + url.search;
  return path === '/' ? null : path;
}

// The path (for a relative Location) to send a logged-out visitor to, remembering `returnTo`.
export function withReturnTo(path: string, returnTo: string | null | undefined): string {
  const safe = safeReturnTo(returnTo);
  return safe ? `${path}?${RETURN_TO_PARAM}=${encodeURIComponent(safe)}` : path;
}
