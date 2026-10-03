import { ClipboardList, Loader2 } from 'lucide-react';
import QuillIconWavy from '@/components/QuillIconWavy';

// The icon on a habit's Log button: the quill, plus a form icon when the button opens the entry
// sheet rather than logging on the tap, so it's clear which one a tap will do. A spinner stands in
// for the quill while logging.
export default function LogButtonIcon({ hasForm, busy, size = 'md' }: { hasForm: boolean; busy: boolean; size?: 'md' | 'lg' }) {
  const quillClass = size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  const formClass = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

  return (
    <span className="inline-flex items-center gap-1">
      {busy ? <Loader2 className={`${quillClass} animate-spin`} /> : <QuillIconWavy className={quillClass} strokeWidth={2.5} />}
      {hasForm && <ClipboardList className={`${formClass} opacity-80`} strokeWidth={2.5} aria-hidden="true" />}
    </span>
  );
}
