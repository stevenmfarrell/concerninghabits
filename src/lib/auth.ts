import { cache } from 'react';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const DAY_MS = 24 * 60 * 60 * 1000;
// Sessions expire after 30 days without use. Each use pushes the expiry out again (at most once a day).
const SESSION_TTL_MS = 30 * DAY_MS;
const SESSION_REFRESH_INTERVAL_MS = DAY_MS;
// Server components can't update cookies, so the cookie outlives the session and the
// database expiry is what actually ends it. 400 days is the browser maximum.
const SESSION_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;

export async function createSession(userId: string) {
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    }
  });

  const cookieStore = await cookies();

  cookieStore.set('session', session.id, {
    maxAge: SESSION_COOKIE_MAX_AGE_S,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
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
