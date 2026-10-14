import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import LoginForm from './LoginForm';
import GoogleSignIn from './GoogleSignIn';
import { RETURN_TO_PARAM, safeReturnTo } from '@/lib/returnTo';
import { isCloud } from '@/lib/deployment';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Render per request: otherwise this page is prerendered at build time, freezing whichever
  // redirect the build machine's database (if any) happened to produce.
  await connection();
  const params = await searchParams;
  const next = params[RETURN_TO_PARAM];
  const returnTo = safeReturnTo(typeof next === 'string' ? next : null);

  // The hosted version signs in with Google, and has no first user to set up
  if (isCloud()) {
    return <GoogleSignIn returnTo={returnTo} error={typeof params.error === 'string' ? params.error : null} />;
  }

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    redirect('/setup');
  }

  return <LoginForm returnTo={returnTo} />;
}
