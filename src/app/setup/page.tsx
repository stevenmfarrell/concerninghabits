import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import SetupForm from './SetupForm';
import { isCloud } from '@/lib/deployment';

export default async function SetupPage() {
  // Render per request, so the "setup already done" check reads the live database rather than
  // whatever the build machine's database looked like (see the login page).
  await connection();
  // The hosted version has no first user to set up: everyone signs up with Google
  if (isCloud()) redirect('/login');
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    redirect('/login');
  }

  return <SetupForm />;
}
