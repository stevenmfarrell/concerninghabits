'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions/auth';
import { Loader2 } from 'lucide-react';
import { RETURN_TO_PARAM } from '@/lib/returnTo';
import AuthBrand from '@/components/AuthBrand';
import { PANE_INSET, PaneField, PanePage, PaneSection } from '@/components/Pane';
import { Button } from '@/components/ui/Button';
import { INPUT } from '@/components/ui/Input';

export default function LoginForm({ returnTo }: { returnTo: string | null }) {
  const [state, action, isPending] = useActionState(
    async (_prevState: Awaited<ReturnType<typeof login>> | null, formData: FormData) => {
      return await login(formData);
    },
    null
  );

  return (
    <PanePage width="md" centered>
      <AuthBrand />

      <form action={action}>
        {returnTo && <input type="hidden" name={RETURN_TO_PARAM} value={returnTo} />}
        <PaneSection title="Sign In">
          <PaneField label="Email" htmlFor="email">
            <input id="email" type="email" name="email" required autoComplete="email" className={INPUT} placeholder="you@example.com" />
          </PaneField>
          <PaneField label="Password" htmlFor="password">
            <input id="password" type="password" name="password" required autoComplete="current-password" className={INPUT} placeholder="••••••••" />
          </PaneField>
        </PaneSection>

        <div className={`${PANE_INSET} py-4 space-y-3`}>
          {state?.error && <p className="text-sm text-danger-ink" role="alert">{state.error}</p>}
          <Button type="submit" size="lg" disabled={isPending} className="w-full">
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
          </Button>
        </div>
      </form>
    </PanePage>
  );
}
