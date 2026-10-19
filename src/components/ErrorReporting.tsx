'use client';

import { useEffect } from 'react';
import type { ErrorReportingConfig } from '@/lib/errorReporting';
import { PRIVATE_OPTIONS } from '@/lib/errorScrubbing';

// Reports the browser's errors to Sentry, with the server's settings (see errorReporting.ts), which
// are read when the page is served rather than built in, so the same build reports or doesn't
// depending on where it runs. Without them Sentry's code isn't even loaded.
export default function ErrorReporting({ config }: { config: ErrorReportingConfig | null }) {
  useEffect(() => {
    if (!config) return;
    import('@sentry/nextjs').then(Sentry => {
      if (Sentry.getClient()) return;
      Sentry.init({ ...config, ...PRIVATE_OPTIONS });
    });
  }, [config]);
  return null;
}

// Reports an error caught by an error boundary (see global-error.tsx), which never reaches the
// browser's own error handlers. One with a digest came from the server, which reported it already.
export function reportBoundaryError(error: Error & { digest?: string }) {
  if (error.digest) return;
  import('@sentry/nextjs').then(Sentry => Sentry.captureException(error));
}
