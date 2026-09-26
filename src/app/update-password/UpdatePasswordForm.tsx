'use client';

import { useActionState } from 'react';
import { updatePassword } from '@/app/actions/auth';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function UpdatePasswordForm({ needsUpdate }: { needsUpdate: boolean }) {
  const router = useRouter();

  const [state, action, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const result = await updatePassword(formData);
      if (result?.error) {
        return { error: result.error, success: false };
      }
      return { error: null, success: true };
    },
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success("Password updated successfully!");
      if (needsUpdate) {
        router.push('/');
      } else {
        router.push('/settings');
      }
    }
  }, [state?.success, router, needsUpdate]);

  return (
    <form action={action} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-stone-700">Current Password</label>
        <div className="mt-1">
          <input
            name="currentPassword"
            type="password"
            required
            className="appearance-none block w-full px-4 py-3 border border-stone-200 rounded-xl placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-stone-50"
            placeholder="••••••••"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700">New Password</label>
        <div className="mt-1">
          <input
            name="newPassword"
            type="password"
            required
            minLength={6}
            className="appearance-none block w-full px-4 py-3 border border-stone-200 rounded-xl placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-stone-50"
            placeholder="••••••••"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700">Confirm New Password</label>
        <div className="mt-1">
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            className="appearance-none block w-full px-4 py-3 border border-stone-200 rounded-xl placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm bg-stone-50"
            placeholder="••••••••"
          />
        </div>
      </div>

      {state?.error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-sm text-red-600">{state.error}</p>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={isPending || state?.success}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-70 transition-colors"
        >
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (needsUpdate ? 'Set Password & Continue' : 'Update Password')}
        </button>
      </div>
      
      {!needsUpdate && (
        <button
          type="button"
          onClick={() => router.push('/settings')}
          className="w-full flex justify-center py-3 px-4 border border-stone-200 rounded-xl shadow-sm text-sm font-medium text-stone-700 bg-white hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-500 transition-colors mt-3"
        >
          Cancel
        </button>
      )}
    </form>
  );
}
