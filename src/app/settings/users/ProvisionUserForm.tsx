'use client';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

import { useActionState, useState, useEffect } from 'react';
import { provisionUser } from '@/app/actions/auth';
import { Loader2, Plus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ProvisionUserForm() {
  const [isOpen, setIsOpen] = useState(false);
  
  const [state, action, isPending] = useActionState(
    async (_prevState: { error: string | null, success: boolean } | null, formData: FormData) => {
      const result = await provisionUser(formData);
      if (result?.error) {
        return { error: result.error, success: false };
      }
      return { error: null, success: true };
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
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="w-4 h-4" /> Provision User
      </Button>

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
                    minLength={MIN_PASSWORD_LENGTH}
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="provision-form"
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Account
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
