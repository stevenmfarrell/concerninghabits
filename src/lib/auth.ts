import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';
import { DAY_MS } from './timezone';

// Sessions expire after 30 days without use. Each use pushes the expiry out again (at most once a day).
const SESSION_TTL_MS = 30 * DAY_MS;
const SESSION_REFRESH_INTERVAL_MS = DAY_MS;
// Server components can't update cookies, so the cookie outlives the session and the
// database expiry is what actually ends it. 400 days is the browser maximum.
const SESSION_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;

// Whether the session cookie should be Secure (sent only over https). Browsers drop a Secure cookie
// set over plain http anywhere but localhost, so always setting it would make signing in silently
// fail at e.g. http://nas.local:3000. So it follows the request: Next fills in x-forwarded-proto
// from the connection unless a reverse proxy already set it (the first entry is the client's side).
// COOKIE_SECURE=true or false overrides that, e.g. for a TLS proxy that doesn't send the header.
export function isSecureCookie(setting: string | undefined, forwardedProto: string | null) {
  const override = setting?.trim().toLowerCase();
  if (override === 'true') return true;
  if (override === 'false') return false;
  return forwardedProto?.split(',')[0].trim().toLowerCase() === 'https';
}

export async function createSession(userId: string) {
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    }
  });

  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

  cookieStore.set('session', session.id, {
    maxAge: SESSION_COOKIE_MAX_AGE_S,
    httpOnly: true,
    secure: isSecureCookie(process.env.COOKIE_SECURE, headerStore.get('x-forwarded-proto')),
    sameSite: 'lax',
    path: '/',
  });
}

// Memoized per request: a page render calls this once per server action it uses, and each call
// would otherwise repeat the session lookup (and the sliding-expiry write).
export const verifySession = cache(async () => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }
  
  const sessionId = sessionCookie.value;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return null;
    }

    const now = Date.now();
    const remaining = session.expiresAt.getTime() - now;

    if (remaining <= 0) {
      await prisma.session.delete({ where: { id: sessionId } });
      return null;
    }

    // Slide the expiry forward while the session is in use. This also trims sessions created
    // before the 30-day limit, which could have up to a year left.
    if (remaining < SESSION_TTL_MS - SESSION_REFRESH_INTERVAL_MS || remaining > SESSION_TTL_MS) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { expiresAt: new Date(now + SESSION_TTL_MS) }
      });
    }

    return { userId: session.userId, sessionId: session.id };
  } catch {
    return null;
  }
});

export async function deleteSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (sessionCookie && sessionCookie.value) {
    try {
      await prisma.session.delete({
        where: { id: sessionCookie.value }
      });
    } catch {
      // Ignore if session already doesn't exist
    }
  }

  cookieStore.delete('session');
}
