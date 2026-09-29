import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  // Render per request: otherwise this page is prerendered at build time, freezing whichever
  // redirect the build machine's database (if any) happened to produce.
  await connection();
  const userCount = await prisma.user.count();

  if (userCount === 0) {
    redirect('/setup');
  }

  return <LoginForm />;
}
