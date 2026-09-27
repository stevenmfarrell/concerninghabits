import { getDefaultUser } from '@/app/actions/db';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import ProvisionUserForm from './ProvisionUserForm';
import DeleteUserButton from './DeleteUserButton';
import { Shield } from 'lucide-react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function UsersSettingsPage() {
  const currentUser = await getDefaultUser();

  if (!currentUser.isAdmin) {
    redirect('/');
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' }
  });

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <Link href="/settings" className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-800 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Settings
          </Link>
          <h1 className="text-3xl font-bold text-stone-900">Family Users</h1>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100 space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <h2 className="text-xl font-bold text-stone-800">Manage Users</h2>
            <ProvisionUserForm />
          </div>
          
          <div className="space-y-6">
            <ul className="space-y-3">
              {users.map(user => (
                <li key={user.id} className="p-4 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-900">{user.name}</span>
                      {user.isAdmin && (
                        <Shield className="w-3.5 h-3.5 text-emerald-600" aria-label="Admin" />
                      )}
                    </div>
                    <span className="text-sm text-stone-500">ID: {user.id.slice(0, 8)}...</span>
                  </div>
                  {user.id !== currentUser.id && (
                    <DeleteUserButton userId={user.id} userName={user.name} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
