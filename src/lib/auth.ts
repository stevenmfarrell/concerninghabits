import { cookies } from 'next/headers';
import { prisma } from './prisma';

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 365 days
  
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
    }
  });

  const cookieStore = await cookies();

  cookieStore.set('session', session.id, {
    expires: expiresAt,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export async function verifySession() {
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

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: sessionId } });
      return null;
    }

    return { userId: session.userId, sessionId: session.id };
  } catch (error) {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (sessionCookie && sessionCookie.value) {
    try {
      await prisma.session.delete({
        where: { id: sessionCookie.value }
      });
    } catch (e) {
      // Ignore if session already doesn't exist
    }
  }

  cookieStore.delete('session');
}
