import { deleteSession } from '@/lib/auth';

export async function GET() {
  await deleteSession();
  // A relative Location, resolved by the browser against the address it actually used. Building an
  // absolute URL from `request.url` would use the server's own bind address instead (e.g.
  // http://0.0.0.0:3000 in the standalone Docker server), which breaks behind a reverse proxy.
  return new Response(null, { status: 307, headers: { Location: '/login' } });
}
