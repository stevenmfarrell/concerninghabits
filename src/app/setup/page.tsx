import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import SetupForm from './SetupForm';

export default async function SetupPage() {
  const userCount = await prisma.user.count();
  
  if (userCount > 0) {
    redirect('/login');
  }

  return <SetupForm />;
}
