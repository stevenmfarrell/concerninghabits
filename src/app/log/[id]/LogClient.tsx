'use client';

import { useEffect, useRef, useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { logHabitEvent, toggleFavorite } from '../../actions/db';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Link2, Mic, Camera, MoreVertical, Edit2, ChevronRight, Star, Upload, Users, FolderInput, Zap } from 'lucide-react';
import ActivityCalendar from '../../../components/ActivityCalendar';
import QuillIconWavy from '../../../components/QuillIconWavy';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { IconButton } from '@/components/ui/IconButton';
import toast from 'react-hot-toast';
import { HABIT_FORM_WIDGETS, habitFormUiSchema, parseHabitSchema, type HabitFormProperties } from '@/components/widgets/habitForm';
import { DEFAULT_TARGET_COUNT } from '@/lib/constants';
import { takePendingSmartEntry } from '@/lib/pendingSmartEntry';
import type { HabitWithLogs, SessionUser } from '@/lib/types';
import { isSharedHabit, type Person } from '@/lib/userColors';
import PersonLabel from '@/components/PersonLabel';
import { showLoggedToast } from '@/components/LoggedToast';
import ShareDialog from './ShareDialog';
import { useVoiceLogging } from './useVoiceLogging';
import { useImageLogging } from './useImageLogging';
import { useCsvImport } from './useCsvImport';

export default function LogClient({ habit, user, people }: { habit: HabitWithLogs, user: SessionUser, people: Record<string, Person> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const isShared = isSharedHabit(habit.userId, habit.memberIds.length, habit.logs);
  const sharedWith = habit.memberIds.filter(id => id !== habit.userId);

  const [logDate, setLogDate] = useState('');
  const [showBackdate, setShowBackdate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(!!habit.isFavorite);

  const handleToggleFavorite = async () => {
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      setIsFavorite(await toggleFavorite(habit.id));
    } catch (err) {
      setIsFavorite(!next);
      toast.error(`Failed to update favorite: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const schema = parseHabitSchema(habit.schema);
  const schemaProperties = schema.properties as HabitFormProperties | undefined;
  const uiSchema = habitFormUiSchema(schemaProperties);

  // Prefill from URL search params (e.g. a shortcut or automation). Read through useSearchParams
  // rather than window.location, which still holds the previous page's URL when this renders during
  // a client-side navigation (e.g. the redirect back here after logging in).
  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    const initialData: Record<string, unknown> = {};
    searchParams.forEach((val, key) => {
      const propSchema = schemaProperties?.[key];
      if (propSchema) {
        if (propSchema.type === 'number' || propSchema.type === 'integer') {
          initialData[key] = Number(val);
        } else if (propSchema.type === 'boolean') {
          initialData[key] = val === 'true';
        } else {
          initialData[key] = val;
        }
      }
    });
    return initialData;
  });

  const hasRequiredFields = (data: Record<string, unknown>) =>
    (schema.required || []).every((field: string) =>
      data[field] !== undefined && data[field] !== null && data[field] !== ''
    );

  // After any entry is logged: confirm it in a toast (with Undo) and go to the habit's history, where
  // it shows. `source` says how an automatic entry was made; `toastId` is a loading toast to replace.
  const announceLogged = (logId: string, data: Record<string, unknown>, source?: string, toastId?: string) => {
    showLoggedToast(
      { habitId: habit.id, habitName: habit.name, logId, data, schemaProperties, source },
      href => router.push(href),
      toastId,
    );
    router.push(`/history/${habit.id}`);
  };

  // A "submit URL" (the prefill URL plus `submit=1`) logs the entry as soon as the page opens and
  // confirms it the same way as voice/photo logging. The ref guards against Strict Mode running
  // the effect twice, and `submit` is stripped from the address bar first so a refresh or
  // back-navigation doesn't log a second entry.
  const autoSubmitStarted = useRef(false);
  useEffect(() => {
    if (autoSubmitStarted.current || searchParams.get('submit') !== '1') return;
    autoSubmitStarted.current = true;

    const params = new URLSearchParams(searchParams.toString());
    params.delete('submit');
    // Deferred a tick: on a full page load this effect runs before the app router's own mount effects,
    // which would otherwise write the original URL (still with `submit`) back over this one.
    setTimeout(() => window.history.replaceState(null, '', params.size ? `${pathname}?${params}` : pathname));

    if (!hasRequiredFields(formData)) {
      toast.error('Submit URL is missing required fields. Please complete the form.');
      return;
    }
    logHabitEvent(habit.id, formData, undefined)
      .then(log => announceLogged(log.id, formData, 'From a submit link'))
      .catch(err => toast.error(`Failed to log entry: ${err instanceof Error ? err.message : 'Unknown error'}`));
    // Only ever runs on the initial mount, with the formData prefilled from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAiExtractionSuccess = async (extractedData: Record<string, unknown>, loadingToastId: string, source: string) => {
    if (Object.keys(extractedData).length === 0) {
      toast.error('Could not find any relevant data.', { id: loadingToastId });
      return;
    }

    const newFormData = { ...formData, ...extractedData };
    setFormData(newFormData);

    if (hasRequiredFields(newFormData)) {
      try {
        const log = await logHabitEvent(habit.id, newFormData, undefined);
        announceLogged(log.id, newFormData, source, loadingToastId);
      } catch {
        toast.error('AI filled the form, but auto-submit failed.', { id: loadingToastId });
      }
    } else {
      toast.success('Form partially filled by AI. Please complete missing fields.', { id: loadingToastId });
    }
  };

  const { isListening, isProcessing: voiceProcessing, toggleListen, processTranscript } = useVoiceLogging(habit.schema, habit.aiContext, handleAiExtractionSuccess);

  // Something the user said or typed on the dashboard that was matched to this habit (see SmartEntry).
  // Fill the form from it the same way as voice logging here, or, for a habit with no fields,
  // log it straight away.
  useEffect(() => {
    const transcript = takePendingSmartEntry(habit.id);
    if (!transcript) return;

    if (Object.keys(schemaProperties || {}).length > 0) {
      processTranscript(transcript, 'AI is filling in your entry...');
    } else {
      logHabitEvent(habit.id, {}, undefined)
        .then(log => announceLogged(log.id, {}, `From “${transcript}”`))
        .catch(err => toast.error(`Failed to log entry: ${err instanceof Error ? err.message : 'Unknown error'}`));
    }
    // Only ever runs on the initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { fileInputRef, isProcessing: imageProcessing, handleImageUpload } = useImageLogging(habit.schema, habit.aiContext, handleAiExtractionSuccess);
  const { importInputRef, importing, handleImportCsv } = useCsvImport(habit.id, () => router.push(`/history/${habit.id}`));
  const aiLoading = voiceProcessing || imageProcessing;

  const handleManualSubmit = async () => {
    try {
      setLoading(true);

      let createdAt = undefined;
      if (logDate) {
        createdAt = new Date(logDate);
      }

      const log = await logHabitEvent(habit.id, formData || {}, createdAt);
      announceLogged(log.id, formData || {});
    } catch (err) {
      toast.error(`Failed to log entry: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = (submit: boolean) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.search = '';

    Object.entries(formData).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.set(key, String(val));
      }
    });

    if (submit) url.searchParams.set('submit', '1');

    navigator.clipboard.writeText(url.toString());
    toast.success(submit ? 'Submit URL copied to clipboard!' : 'Automation URL copied to clipboard!');
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        backHref="/"
        title={<span className="truncate">{habit.name}</span>}
        titleInsetClassName="px-24"
        actions={
          <>
            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-full transition-colors shrink-0 hover:bg-stone-100 ${isFavorite ? 'text-amber-500' : 'text-stone-500 hover:text-stone-700'}`}
              title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              aria-label={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              aria-pressed={isFavorite}
            >
              <Star className={`w-6 h-6 ${isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <IconButton onClick={() => setMenuOpen(!menuOpen)} edge="right" title="More options">
              <MoreVertical className="w-6 h-6" />
            </IconButton>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-stone-100 py-2 z-50">
                  {/* Someone a habit is shared with can't edit it, only file it or remove it from their lists */}
                  <Link
                    href={`/edit/${habit.id}`}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-600 transition-colors"
                  >
                    {habit.isOwner ? <Edit2 className="w-4 h-4" /> : <FolderInput className="w-4 h-4" />}
                    {habit.isOwner ? 'Edit Habit' : 'Move or Remove'}
                  </Link>
                  {habit.isOwner && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setShareOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-600 transition-colors text-left"
                    >
                      <Users className="w-4 h-4" />
                      Share
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleCopyUrl(false);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-600 transition-colors text-left"
                  >
                    <Link2 className="w-4 h-4" />
                    Copy URL
                  </button>
                  <button
                    onClick={() => {
                      handleCopyUrl(true);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-600 transition-colors text-left"
                  >
                    <Zap className="w-4 h-4" />
                    Copy Submit URL
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      importInputRef.current?.click();
                    }}
                    disabled={importing}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-600 transition-colors text-left disabled:opacity-50"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Import CSV
                  </button>
                </div>
              </>
            )}
            <input
              type="file"
              accept=".csv,text/csv"
              ref={importInputRef}
              className="hidden"
              onChange={handleImportCsv}
            />
          </>
        }
      />

      {shareOpen && (
        <ShareDialog
          habitId={habit.id}
          habitName={habit.name}
          candidates={Object.values(people).filter(p => p.id !== user.id)}
          sharedWithIds={sharedWith}
          onClose={() => setShareOpen(false)}
          onSaved={() => {
            setShareOpen(false);
            router.refresh();
          }}
        />
      )}

      <div className="p-4 sm:p-8 max-w-xl mx-auto w-full space-y-6 sm:space-y-8">
        {habit.description && <p className="text-stone-600 text-center">{habit.description}</p>}

        {habit.isOwner && sharedWith.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 -mt-2 text-xs text-stone-500">
            <span>Shared with</span>
            {sharedWith.map(id => <PersonLabel key={id} person={people[id]} />)}
          </div>
        )}
        {!habit.isOwner && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 -mt-2 text-xs text-stone-500">
            <span>Shared by</span>
            <PersonLabel person={people[habit.userId]} />
          </div>
        )}

      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-stone-800">New Entry</h2>
          {Object.keys(schemaProperties || {}).length > 0 && (schema.enableVoice !== false || schema.enablePhoto !== false) && (
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                className="hidden"
                onChange={handleImageUpload}
              />
              {schema.enablePhoto !== false && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={aiLoading}
                  className="w-14 h-14 flex items-center justify-center rounded-xl border-2 transition-all shadow-sm bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100 hover:border-blue-200 disabled:opacity-70"
                  title="Photo Log"
                >
                  {aiLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" strokeWidth={2.5} />}
                </button>
              )}
              {schema.enableVoice !== false && (
                <button
                  onClick={toggleListen}
                  disabled={aiLoading}
                  className={`w-14 h-14 flex items-center justify-center rounded-xl border-2 transition-all shadow-sm ${
                    isListening
                      ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
                      : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200'
                  } disabled:opacity-70`}
                  title="Voice Log"
                >
                  {aiLoading ? (
                     <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                     <Mic className="w-6 h-6" strokeWidth={2.5} />
                  )}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="space-y-6">

          <div className="rjsf-custom">
            <Form
              schema={schema}
              uiSchema={uiSchema}
              widgets={HABIT_FORM_WIDGETS}
              validator={validator}
              formData={formData}
              onChange={(e) => setFormData(e.formData)}
              disabled={loading}
              noHtml5Validate={true}
              showErrorList={false}
              className="space-y-6 rjsf"
              onSubmit={() => handleManualSubmit()}
            >
              <div className="space-y-4 pt-4">
              {showBackdate && (
                <div className="animate-in fade-in slide-in-from-bottom-2 p-4 bg-stone-50 border border-stone-200 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-stone-700">
                      Custom Date & Time
                    </label>
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
                    type="datetime-local"
                    className="w-full px-4 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-stone-700 text-sm"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium text-lg hover:bg-emerald-700 cursor-pointer transition-colors flex justify-center items-center gap-2 disabled:opacity-70 shadow-sm"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <QuillIconWavy className="w-6 h-6" strokeWidth={2.5} />}
                {loading ? 'Logging...' : 'Log Habit'}
              </button>

              {!showBackdate && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowBackdate(true)}
                    className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    Backdate log
                  </button>
                </div>
              )}
            </div>
            </Form>
          </div>
        </div>
      </div>

      <Link
        href={`/history/${habit.id}`}
        className="block bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100 hover:border-emerald-200 hover:shadow-md transition-all group"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-stone-800">Recent History</h2>
          <div className="flex items-center text-sm font-medium text-stone-400 group-hover:text-emerald-600 transition-colors">
            View All <ChevronRight className="w-4 h-4 ml-1" />
          </div>
        </div>
        <div className="opacity-80 group-hover:opacity-100 transition-opacity flex justify-center w-full overflow-hidden py-2">
          <ActivityCalendar
            dates={habit.logs.map(l => l.createdAt)} size="md"
            loggedBy={isShared ? habit.logs.map(l => l.userId) : undefined}
            people={isShared ? people : undefined}
            weeks={5}
            frequency={habit.frequency}
            targetCount={schema.targetCount || DEFAULT_TARGET_COUNT}
            bedtime={user.bedtime}
            weekStartsOn={user.weekStartsOn}
            timeZone={user.timeZone}
          />
        </div>
      </Link>

    </div>
    </div>
  );
}
