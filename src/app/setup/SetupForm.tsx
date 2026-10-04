'use client';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

import { useActionState } from 'react';
import { setupInitialAdmin } from '@/app/actions/auth';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import AuthBrand from '@/components/AuthBrand';
import { PANE_INSET, PaneField, PanePage, PaneSection } from '@/components/Pane';
import { Button } from '@/components/ui/Button';
import { INPUT } from '@/components/ui/Input';

export default function SetupForm() {
  const [state, action, isPending] = useActionState(
    async (_prevState: Awaited<ReturnType<typeof setupInitialAdmin>> | null, formData: FormData) => {
      return await setupInitialAdmin(formData);
    },
    null
  );

  return (
    <PanePage width="md" centered>
      <AuthBrand subtitle="Create the first family admin account" />

      <form action={action}>
        <PaneSection title="Admin Account">
          <PaneField label="Name" htmlFor="name">
            <input id="name" type="text" name="name" required autoComplete="name" className={INPUT} placeholder="Your Name" />
          </PaneField>
          <PaneField label="Email" htmlFor="email">
            <input id="email" type="email" name="email" required autoComplete="email" className={INPUT} placeholder="you@example.com" />
          </PaneField>
          <PaneField label="Password" htmlFor="password">
            <input id="password" type="password" name="password" required autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} className={INPUT} placeholder="••••••••" />
          </PaneField>
        </PaneSection>

        <div className={`${PANE_INSET} py-4 space-y-3`}>
          {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
          <Button type="submit" size="lg" disabled={isPending} className="w-full">
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
          </Button>
          <p className="text-center text-sm text-stone-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-emerald-600 hover:text-emerald-500 transition-colors">
              Sign in here
            </Link>
          </p>
        </div>
      </form>
    </PanePage>
  );
}
