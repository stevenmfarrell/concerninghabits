'use client';

import { useEffect, useState } from 'react';
import { Check, Undo2 } from 'lucide-react';
import { formatLogValue } from '@/lib/format';

type SchemaProperties = Record<string, { title?: string; type?: string; 'x-widget'?: string; 'x-unit'?: string }> | undefined;

// Mounted only while an auto-submitted log (AI-filled, or from a submit URL) is showing (LogClient swaps this in for the whole page), so
// its countdown state starts fresh every time without needing to detect and reset on re-show.
export default function AiSuccessSplash({
  data,
  schemaProperties,
  subtitle,
  onUndo,
  onContinue,
}: {
  data: Record<string, unknown>;
  schemaProperties: SchemaProperties;
  subtitle: string;
  onUndo: () => void;
  onContinue: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(100);

  useEffect(() => {
    // Start full and drop to empty a tick later so the CSS transition below animates the fill
    // draining over `transitionDuration`, then auto-continue once it's done.
    const fillTimer = setTimeout(() => setTimeLeft(0), 50);
    const navigateTimer = setTimeout(onContinue, 6000);
    return () => {
      clearTimeout(fillTimer);
      clearTimeout(navigateTimer);
    };
  }, [onContinue]);

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-white rounded-2xl shadow-sm border border-emerald-100">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 ring-8 ring-emerald-50">
          <Check className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Logged Successfully</h1>
        <p className="text-stone-500 mb-8">{subtitle}</p>

        <div className="w-full bg-stone-50 rounded-xl p-4 text-left border border-stone-200 mb-8 max-h-64 overflow-y-auto">
          {Object.entries(data).map(([key, val]) => {
            const label = schemaProperties?.[key]?.title || key;
            return (
              <div key={key} className="flex justify-between items-center py-2 border-b border-stone-100 last:border-0">
                <span className="text-sm font-medium text-stone-500">{label}</span>
                <span className="text-sm font-semibold text-stone-900">{formatLogValue(val, schemaProperties?.[key])}</span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={onUndo}
            className="flex-1 py-3 px-4 bg-white border-2 border-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
          >
            <Undo2 className="w-4 h-4" />
            Undo & Edit
          </button>
          <button
            onClick={onContinue}
            className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
          >
            Continue
          </button>
        </div>

        <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mt-6">
          <div
            className="h-full bg-emerald-500 ease-linear transition-all"
            style={{ width: `${timeLeft}%`, transitionDuration: '6000ms' }}
          />
        </div>
      </div>
    </div>
  );
}
