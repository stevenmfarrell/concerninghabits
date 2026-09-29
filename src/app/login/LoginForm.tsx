'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions/auth';
import { Loader2 } from 'lucide-react';
import { RETURN_TO_PARAM } from '@/lib/returnTo';

export default function LoginForm({ returnTo }: { returnTo: string | null }) {
  const [state, action, isPending] = useActionState(
    async (_prevState: Awaited<ReturnType<typeof login>> | null, formData: FormData) => {
      return await login(formData);
    },
    null
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-stone-100 p-8">
        <div className="text-center mb-10 flex flex-col items-center">
          <img src="/hobbit-hole.svg" alt="Hobbit Hole" className="w-full max-w-xs h-auto" />
          <img src="/title-text.svg" alt="Concerning Habits" className="w-full max-w-xs h-auto mt-2" />
          <img src="/plant-icon.svg" alt="Plant Icon" className="w-12 h-auto -mt-2" />
          <p className="text-stone-500 mt-10 font-medium">Sign in to your account</p>
        </div>

        <form action={action} className="space-y-6">
          {returnTo && <input type="hidden" name={RETURN_TO_PARAM} value={returnTo} />}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
            <input 
              type="email" 
              name="email"
              required
              className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-stone-50"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
            <input 
              type="password" 
              name="password"
              required
              className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-stone-50"
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-70 transition-colors"
          >
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
}
