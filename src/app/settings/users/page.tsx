import { getDefaultUser } from '@/app/actions/db';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import ProvisionUserForm from './ProvisionUserForm';
import DeleteUserButton from './DeleteUserButton';
import { User, Shield } from 'lucide-react';
import Link from 'next/link';

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
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/settings/categories" className="text-stone-400 hover:text-stone-600">
            Categories
          </Link>
          <span className="text-stone-300">/</span>
          <h1 className="text-2xl font-bold text-stone-900">Manage Users</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-stone-800">Family Members</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 divide-y divide-stone-100">
              {users.map(user => (
                <div key={user.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-stone-900 flex items-center gap-2">
                      {user.name}
                      {user.isAdmin && <Shield className="w-4 h-4 text-emerald-600" />}
                    </p>
                    <p className="text-sm text-stone-500">{user.email}</p>
                  </div>
                  {user.id !== currentUser.id && (
                    <DeleteUserButton userId={user.id} userName={user.name} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-stone-800">Provision New Account</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
              <ProvisionUserForm />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
