import { vi } from 'vitest';

// A tiny stand-in for Next's cookie jar, shared across a test file so tests can log in as
// different users by changing which session id the "session" cookie holds.
export const cookieJar = new Map<string, string>();

export function setSessionCookie(sessionId: string | undefined) {
  if (sessionId === undefined) cookieJar.delete('session');
  else cookieJar.set('session', sessionId);
}

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => { cookieJar.set(name, value); },
    delete: (name: string) => { cookieJar.delete(name); },
  }),
  headers: async () => new Headers(),
}));

// The real redirect() throws a special NEXT_REDIRECT value understood by the Next.js runtime,
// which doesn't exist in this test environment. Ownership checks that hit it should surface as a
// thrown error, same as an unauthorized action throwing "Unauthorized" would.
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
  notFound: () => { throw new Error('NOT_FOUND'); },
}));

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

// Connects whoever the session cookie signs in as to `userIds` (see src/lib/connections.ts), as
// adding a family member or accepting an invite would, so they can share habits with each other.
// Test users are made straight in the database, so they start out connected to no one.
export async function connectSignedInUserTo(...userIds: string[]) {
  const { prisma } = await import('@/lib/prisma');
  const { connect } = await import('@/lib/connections');
  const session = await prisma.session.findUniqueOrThrow({ where: { id: cookieJar.get('session') } });
  for (const id of userIds) await connect(session.userId, id);
}
