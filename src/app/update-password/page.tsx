import { getDefaultUser } from '@/app/actions/db';
import UpdatePasswordForm from './UpdatePasswordForm';
import { Lock } from 'lucide-react';

export default async function UpdatePasswordPage() {
  const user = await getDefaultUser(true);

  return (
    <main className="min-h-screen bg-stone-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-emerald-600 mb-6">
          <Lock className="w-12 h-12" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-stone-900">
          Update Your Password
        </h2>
        {user.passwordNeedsUpdate ? (
          <p className="mt-2 text-center text-sm text-stone-600">
            Welcome, {user.name}! Please set a new password for your account to continue.
          </p>
        ) : (
          <p className="mt-2 text-center text-sm text-stone-600">
            Change your password securely.
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-stone-200/50 sm:rounded-3xl sm:px-10 border border-stone-100">
          <UpdatePasswordForm needsUpdate={user.passwordNeedsUpdate} />
        </div>
      </div>
    </main>
  );
}
