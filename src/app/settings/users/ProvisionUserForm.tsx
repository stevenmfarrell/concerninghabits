'use client';

import { useActionState, useState, useEffect } from 'react';
import { provisionUser } from '@/app/actions/auth';
import { Loader2, Plus, UserPlus } from 'lucide-react';

export default function ProvisionUserForm() {
  const [isOpen, setIsOpen] = useState(false);
  
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

  useEffect(() => {
    if (state?.success) {
      // Small delay so they see the success message
      const timer = setTimeout(() => setIsOpen(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [state?.success]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
      >
        <Plus className="w-4 h-4" /> Provision User
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full shrink-0 bg-stone-100 text-stone-600">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-stone-900">Provision New User</h3>
                  <p className="text-sm text-stone-500 leading-relaxed">
                    Create a new account on this server. They will need the exact User ID to log in.
                  </p>
                </div>
              </div>

              <form action={action} id="provision-form" className="space-y-4">
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
              </form>
            </div>
            
            <div className="p-4 sm:px-8 sm:py-6 bg-stone-50 border-t border-stone-100 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="px-5 py-2.5 text-stone-600 font-medium hover:bg-stone-200 rounded-xl transition-colors disabled:opacity-50 w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="provision-form"
                disabled={isPending}
                className="px-5 py-2.5 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
