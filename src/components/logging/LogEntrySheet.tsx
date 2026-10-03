'use client';

import { useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Camera, History, Loader2, Mic, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import QuillIconWavy from '@/components/QuillIconWavy';
import { HABIT_FORM_WIDGETS, habitFormUiSchema } from '@/components/widgets/habitForm';
import type { HabitLogger } from './useHabitLogger';
import { useVoiceLogging } from './useVoiceLogging';
import { useImageLogging } from './useImageLogging';

// A habit's entry form in a pane that slides up from the bottom, over whatever page the Log button
// was on: its fields (fillable by voice or photo), an optional custom date, and the submit button.
// Render it only while `logger.sheetOpen`, so its speech recognition only exists while it's up.
export default function LogEntrySheet({ logger }: { logger: HabitLogger }) {
  const { habit, schema, properties, hasForm, formData, setFormData, busy, sheetBackdate } = logger;
  const [showBackdate, setShowBackdate] = useState(sheetBackdate);
  const [logDate, setLogDate] = useState('');

  const handleExtracted = (data: Record<string, unknown>, toastId: string, source: string) => logger.fillIn(data, source, toastId);
  const { isListening, isProcessing: voiceProcessing, toggleListen } = useVoiceLogging(habit.schema, habit.aiContext ?? null, handleExtracted);
  const { fileInputRef, isProcessing: imageProcessing, handleImageUpload } = useImageLogging(habit.schema, habit.aiContext ?? null, handleExtracted);
  const aiLoading = voiceProcessing || imageProcessing;
  const showVoice = hasForm && schema.enableVoice !== false;
  const showPhoto = hasForm && schema.enablePhoto !== false;

  const submit = () => logger.logEntry(formData, { createdAt: logDate ? new Date(logDate) : undefined });

  const toggleBackdate = () => {
    if (showBackdate) setLogDate('');
    setShowBackdate(!showBackdate);
  };

  // Split like the Log Habit button on the habit's page: submit, or show the custom date and time
  const submitButton = (
    <div className="flex">
      <Button type={hasForm ? 'submit' : 'button'} size="xl" disabled={busy || aiLoading} className="flex-1 rounded-r-none" onClick={hasForm ? undefined : submit}>
        {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <QuillIconWavy className="w-6 h-6" strokeWidth={2.5} />}
        {busy ? 'Logging...' : 'Log Habit'}
      </Button>
      <Button
        type="button"
        size="xl"
        onClick={toggleBackdate}
        disabled={busy}
        title="Backdate log"
        aria-label="Backdate log"
        aria-pressed={showBackdate}
        className={`rounded-l-none px-5! border-l border-emerald-700 ${showBackdate ? 'bg-emerald-800!' : ''}`}
      >
        <History className="w-6 h-6" strokeWidth={2.5} />
      </Button>
    </div>
  );

  return (
    // Above the bottom nav (z-50), which would otherwise cover the bottom of the sheet on phones
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={logger.closeSheet}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Log ${habit.name}`}
        className="bg-white rounded-t-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="flex-1 min-w-0 text-xl font-bold text-stone-900 truncate">{habit.name}</h2>
            {showPhoto && (
              <>
                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={aiLoading}
                  className="w-12 h-12 flex items-center justify-center rounded-xl border-2 transition-all shadow-sm bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100 hover:border-blue-200 disabled:opacity-70 shrink-0"
                  title="Photo Log"
                >
                  {imageProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" strokeWidth={2.5} />}
                </button>
              </>
            )}
            {showVoice && (
              <button
                type="button"
                onClick={toggleListen}
                disabled={aiLoading}
                className={`w-12 h-12 flex items-center justify-center rounded-xl border-2 transition-all shadow-sm shrink-0 ${
                  isListening
                    ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
                    : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200'
                } disabled:opacity-70`}
                title="Voice Log"
              >
                {voiceProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" strokeWidth={2.5} />}
              </button>
            )}
            <IconButton onClick={logger.closeSheet} edge="right" title="Close">
              <X className="w-6 h-6" />
            </IconButton>
          </div>

          {showBackdate && (
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="log-date" className="block text-sm font-medium text-stone-700">Custom Date & Time</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowBackdate(false);
                    setLogDate('');
                  }}
                  className="text-xs text-stone-500 hover:text-stone-700 font-medium"
                >
                  Cancel
                </button>
              </div>
              <input
                id="log-date"
                type="datetime-local"
                className="w-full px-4 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-stone-700 text-sm"
                value={logDate}
                onChange={e => setLogDate(e.target.value)}
                disabled={busy}
              />
            </div>
          )}

          {hasForm ? (
            <div className="rjsf-custom">
              <Form
                schema={{ ...schema, title: '' }}
                uiSchema={habitFormUiSchema(properties)}
                widgets={HABIT_FORM_WIDGETS}
                validator={validator}
                formData={formData}
                onChange={e => setFormData(e.formData)}
                onSubmit={submit}
                disabled={busy}
                noHtml5Validate
                showErrorList={false}
                className="rjsf space-y-6"
              >
                {submitButton}
              </Form>
            </div>
          ) : submitButton}
        </div>
      </div>
    </div>
  );
}
