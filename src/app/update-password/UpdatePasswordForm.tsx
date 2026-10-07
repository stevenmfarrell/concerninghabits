'use client';
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '@/lib/constants';

import { useActionState } from 'react';
import { updatePassword } from '@/app/actions/auth';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PANE_INSET, PaneField, PaneSection } from '@/components/Pane';
import { Button } from '@/components/ui/Button';
import { INPUT } from '@/components/ui/Input';

export default function UpdatePasswordForm({ needsUpdate }: { needsUpdate: boolean }) {
  const router = useRouter();

  const [state, action, isPending] = useActionState(
    async (_prevState: { error: string | null, success: boolean } | null, formData: FormData) => {
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
    <form action={action}>
      <PaneSection title="Password">
        <PaneField label="Current Password" htmlFor="currentPassword">
          <input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" className={INPUT} placeholder="••••••••" />
        </PaneField>
        <PaneField label="New Password" htmlFor="newPassword">
          <input id="newPassword" name="newPassword" type="password" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_BYTES} autoComplete="new-password" className={INPUT} placeholder="••••••••" />
        </PaneField>
        <PaneField label="Confirm New Password" htmlFor="confirmPassword">
          <input id="confirmPassword" name="confirmPassword" type="password" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_BYTES} autoComplete="new-password" className={INPUT} placeholder="••••••••" />
        </PaneField>
      </PaneSection>

      <div className={`${PANE_INSET} py-4 space-y-3`}>
        {state?.error && <p className="text-sm text-danger-ink" role="alert">{state.error}</p>}
        <Button type="submit" size="lg" disabled={isPending || state?.success} className="w-full">
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (needsUpdate ? 'Set Password & Continue' : 'Update Password')}
        </Button>
      </div>
    </form>
  );
}
