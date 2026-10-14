import AuthBrand from '@/components/AuthBrand';
import { PANE_INSET, PanePage } from '@/components/Pane';
import { buttonClasses } from '@/components/ui/Button';
import { RETURN_TO_PARAM } from '@/lib/returnTo';
import type { GoogleSignInError } from '@/lib/googleSignIn';

// Why the last try at signing in didn't work, from the callback (see loginUrl)
const SIGN_IN_ERRORS: Record<GoogleSignInError, string> = {
  cancelled: 'Signing in was cancelled.',
  expired: 'That sign-in took too long or was started elsewhere. Please try again.',
  failed: 'Google couldn\'t sign you in. Please try again.',
  unverified: 'Your Google account\'s email address isn\'t verified yet. Verify it with Google, then try again.',
  'email-taken': 'That email address already has an account here, but not one that signs in with this Google account.',
  busy: 'Too many sign-in attempts. Please wait a few minutes and try again.',
};

// The sign-in page on the hosted version, which has no passwords: a button that starts signing in
// with Google (see src/app/api/auth/google). A plain link rather than <Link>, since it leaves the
// app for Google rather than moving between pages.
export default function GoogleSignIn({ returnTo, error }: { returnTo: string | null; error: string | null }) {
  const start = returnTo ? `/api/auth/google?${new URLSearchParams({ [RETURN_TO_PARAM]: returnTo })}` : '/api/auth/google';
  const message = error && error in SIGN_IN_ERRORS ? SIGN_IN_ERRORS[error as GoogleSignInError] : null;

  return (
    <PanePage width="md" centered>
      <AuthBrand />
      <div className={`${PANE_INSET} py-4 space-y-3`}>
        {message && <p className="text-sm text-danger-ink text-center" role="alert">{message}</p>}
        <a href={start} className={buttonClasses('outline', 'lg', 'w-full bg-surface text-ink')}>
          <GoogleMark />
          Continue with Google
        </a>
        <p className="text-xs text-ink-muted text-center">
          Your first sign-in makes your account. Concerning Habits only sees your name and email address.
        </p>
      </div>
    </PanePage>
  );
}

// Google's "G", in its own colors, as Google's sign-in branding asks for
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
