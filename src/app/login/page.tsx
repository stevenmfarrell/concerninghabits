import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import LoginForm from './LoginForm';
import { RETURN_TO_PARAM, safeReturnTo } from '@/lib/returnTo';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Render per request: otherwise this page is prerendered at build time, freezing whichever
  // redirect the build machine's database (if any) happened to produce.
  await connection();
  const userCount = await prisma.user.count();

  if (userCount === 0) {
    redirect('/setup');
  }

  const next = (await searchParams)[RETURN_TO_PARAM];
  return <LoginForm returnTo={safeReturnTo(typeof next === 'string' ? next : null)} />;
}
