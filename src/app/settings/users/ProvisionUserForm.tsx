'use client';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

import { useActionState, useState, useEffect } from 'react';
import { provisionUser } from '@/app/actions/auth';
import { Loader2, Plus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { INPUT } from '@/components/ui/Input';

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

  // One element, since it's a row in the users list (its dialog is fixed, so it doesn't take up room)
  return (
    <div>
      {/* The users list's last row, rather than a Button, so it reads as adding to the list */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-2 pane-inset py-3 text-left text-sm font-medium text-accent-ink-strong hover:bg-surface-subtle transition-colors"
      >
        <Plus className="w-4 h-4" /> Provision User
      </button>

      {isOpen && (
        <Dialog label="Provision New User">
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full shrink-0 bg-surface-muted text-ink-secondary">
                <UserPlus className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-ink">Provision New User</h3>
                <p className="text-sm text-ink-muted leading-relaxed">
                  Create a new account on this server. They will need the exact User ID to log in.
                </p>
              </div>
            </div>

            <form action={action} id="provision-form" className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">Name</label>
                <input 
                  type="text" 
                  name="name"
                  required
                  className={INPUT}
                  placeholder="Member Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">Email</label>
                <input 
                  type="email" 
                  name="email"
                  required
                  className={INPUT}
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">Temporary Password</label>
                <input 
                  type="password" 
                  name="password"
                  required
                  className={INPUT}
                  placeholder="••••••••"
                  minLength={MIN_PASSWORD_LENGTH}
                />
              </div>

              {state?.error && (
                <div className="p-3 bg-danger-soft text-danger-ink text-sm rounded-lg border border-danger-line">
                  {state.error}
                </div>
              )}

              {state?.success && (
                <div className="p-3 bg-accent-soft text-accent-ink text-sm rounded-lg border border-accent-line">
                  Account provisioned successfully!
                </div>
              )}
            </form>
          </div>
          
          <DialogFooter>
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
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
