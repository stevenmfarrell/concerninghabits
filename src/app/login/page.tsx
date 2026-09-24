import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  const userCount = await prisma.user.count();
  
  if (userCount === 0) {
    redirect('/setup');
  }

  return <LoginForm />;
}
