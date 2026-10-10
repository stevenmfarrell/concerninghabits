import { logHabitEvent } from '@/app/actions/db';
import { verifySession } from '@/lib/auth';
import { z } from 'zod';

// Logs a habit from its reminder's Done button. The service worker (public/sw.js) calls this with
// the browser's session cookie, which SameSite=Lax keeps from being sent by other sites.
export async function POST(request: Request) {
  if (!(await verifySession())) return new Response('Signed out', { status: 401 });
  const parsed = z.object({ habitId: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response('Bad request', { status: 400 });
  try {
    await logHabitEvent(parsed.data.habitId, {});
    return new Response(null, { status: 204 });
  } catch {
    return new Response("Couldn't log it", { status: 400 });
  }
}
