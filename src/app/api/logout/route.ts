import { deleteSession } from '@/lib/auth';
import { RETURN_TO_PARAM, withReturnTo } from '@/lib/returnTo';
import type { NextRequest } from 'next/server';

// `next` is set when a stale session was bounced here mid-page-load, so login can return to that page.
export async function GET(request: NextRequest) {
  await deleteSession();
  // A relative Location, resolved by the browser against the address it actually used. Building an
  // absolute URL from `request.url` would use the server's own bind address instead (e.g.
  // http://0.0.0.0:3000 in the standalone Docker server), which breaks behind a reverse proxy.
  return new Response(null, { status: 307, headers: { Location: withReturnTo('/login', request.nextUrl.searchParams.get(RETURN_TO_PARAM)) } });
}
