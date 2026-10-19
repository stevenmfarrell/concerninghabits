import { prisma } from '@/lib/prisma';
import { reportError } from '@/lib/errorReporting';

// Whether this server can serve requests, for Docker's HEALTHCHECK, a host's health checks (e.g.
// Fly's) and uptime monitors: 200 when it can read its database, 503 when it can't. Needs no
// sign-in or key, and says nothing more than that, so the error itself only goes to the server's
// log. It doesn't check the AI provider: an outage there shouldn't mark the server unhealthy and
// get it restarted, since everything but AI still works.
export async function GET() {
  try {
    // A real table rather than `SELECT 1`, which SQLite answers without reading the file at all.
    // Fails too for a database whose migrations haven't run.
    await prisma.appSetting.findFirst({ select: { key: true } });
    return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    reportError('Health check failed: the database can\'t be read', error);
    return Response.json({ status: 'error' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
