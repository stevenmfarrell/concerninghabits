'use client';

import { useEffect } from 'react';
import { RotateCw, OctagonAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { reportBoundaryError } from '@/components/ErrorReporting';
import { THEME_SCRIPT } from '@/lib/theme';
import './globals.css';

// What's shown when a page breaks in a way nothing nearer catches, in place of the whole app,
// layout included (so it brings its own <html>, styles and theme). Reports the error too.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => reportBoundaryError(error), [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Something went wrong</title>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-canvas font-sans antialiased">
        <main className="flex-1 p-4 sm:p-8 flex items-center justify-center">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-surface-strong rounded-full flex items-center justify-center mx-auto mb-4">
              <OctagonAlert className="w-10 h-10 text-ink-muted" />
            </div>
            <h1 className="text-xl font-semibold text-ink">Something went wrong</h1>
            <p className="text-ink-secondary">
              This page couldn&apos;t be shown. Try again, or come back in a moment.
            </p>
            <div className="pt-4">
              <Button variant="secondary" size="lg" onClick={retry}>
                <RotateCw className="w-5 h-5" />
                Try Again
              </Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
