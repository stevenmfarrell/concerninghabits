'use client';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

import { useActionState } from 'react';
import { setupInitialAdmin } from '@/app/actions/auth';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export default function SetupForm() {
  const [state, action, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      return await setupInitialAdmin(formData);
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
          <p className="text-stone-500 mt-10 font-medium">Create the first family admin account</p>
        </div>

        <form action={action} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Name</label>
            <input 
              type="text" 
              name="name"
              required
              className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-stone-50"
              placeholder="Your Name"
            />
          </div>

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
              minLength={MIN_PASSWORD_LENGTH}
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
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-emerald-600 hover:text-emerald-500 transition-colors">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
