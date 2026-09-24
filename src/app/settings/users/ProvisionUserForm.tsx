'use client';

import { useActionState } from 'react';
import { provisionUser } from '@/app/actions/auth';
import { Loader2 } from 'lucide-react';

export default function ProvisionUserForm() {
  const [state, action, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const result = await provisionUser(formData);
      if (result?.error) {
        return result;
      }
      return { success: true };
    },
    null
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Name</label>
        <input 
          type="text" 
          name="name"
          required
          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-stone-50 text-sm"
          placeholder="Member Name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
        <input 
          type="email" 
          name="email"
          required
          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-stone-50 text-sm"
          placeholder="email@example.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Temporary Password</label>
        <input 
          type="password" 
          name="password"
          required
          className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-stone-50 text-sm"
          placeholder="••••••••"
          minLength={6}
        />
      </div>

      {state?.error && (
        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-lg border border-emerald-100">
          Account provisioned successfully!
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-70 transition-colors mt-2"
      >
        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
      </button>
    </form>
  );
}
