'use client';

import { useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Camera, CalendarClock, Loader2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import BottomSheet from '@/components/BottomSheet';
import QuillIconWavy from '@/components/QuillIconWavy';
import { HABIT_FORM_WIDGETS, habitFormUiSchema } from '@/components/widgets/habitForm';
import type { HabitLogger } from './useHabitLogger';
import { useVoiceLogging } from './useVoiceLogging';
import { useImageLogging } from './useImageLogging';
import { INPUT } from '@/components/ui/Input';
import { toDateTimeInputValue } from '@/lib/format';

// A habit's entry form in a pane that slides up from the bottom, over whatever page the Log button
// was on: its fields (fillable by voice or photo), an optional custom date, and the submit button.
// Render it only while `logger.sheetOpen`, so its speech recognition only exists while it's up.
export default function LogEntrySheet({ logger }: { logger: HabitLogger }) {
  const { habit, schema, properties, hasForm, formData, setFormData, busy, sheetBackdate, sheetLogDate } = logger;
  const [showBackdate, setShowBackdate] = useState(sheetBackdate);
  const [logDate, setLogDate] = useState(() => (sheetLogDate ? toDateTimeInputValue(sheetLogDate) : ''));

  const handleExtracted = (data: Record<string, unknown>, toastId: string, source: string) => logger.fillIn(data, source, toastId);
  const { isListening, isProcessing: voiceProcessing, toggleListen } = useVoiceLogging(habit, handleExtracted, logger.closeSheet);
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
        className={`rounded-l-none px-5! border-l border-accent-hover ${showBackdate ? 'bg-accent-pressed!' : ''}`}
      >
        <CalendarClock className="w-6 h-6" strokeWidth={2.5} />
      </Button>
    </div>
  );

  return (
    <BottomSheet
      title={habit.name}
      ariaLabel={`Log ${habit.name}`}
      onClose={logger.closeSheet}
      headerActions={
        <>
          {showPhoto && (
            <>
              <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={aiLoading}
                className="w-12 h-12 flex items-center justify-center rounded-xl border-2 transition-all shadow-sm bg-category-soft border-category-line text-category-ink-strong hover:bg-category-soft-strong hover:border-category-line disabled:opacity-70 shrink-0"
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
                  ? 'bg-danger-soft border-danger-line text-danger-ink animate-pulse'
                  : 'bg-accent-soft border-accent-line text-accent-ink-strong hover:bg-accent-soft-strong hover:border-accent-line-strong'
              } disabled:opacity-70`}
              title="Voice Log"
            >
              {voiceProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" strokeWidth={2.5} />}
            </button>
          )}
        </>
      }
    >
      {showBackdate && (
        <div className="p-4 border border-line rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="log-date" className="block text-sm font-medium text-ink-secondary">Custom Date & Time</label>
            <button
              type="button"
              onClick={() => {
                setShowBackdate(false);
                setLogDate('');
              }}
              className="text-xs text-ink-muted hover:text-ink-secondary font-medium"
            >
              Cancel
            </button>
          </div>
          <input
            id="log-date"
            type="datetime-local"
            className={INPUT}
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
    </BottomSheet>
  );
}
