'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toggleFavorite } from '../../actions/db';
import { parseVoiceLog } from '../../actions/habit';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { History, Loader2, Link2, MoreVertical, Edit2, Star, Upload, Users, FolderInput, Zap } from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import toast from 'react-hot-toast';
import { parseHabitSchema, type HabitFormProperties } from '@/components/widgets/habitForm';
import { takePendingSmartEntry } from '@/lib/pendingSmartEntry';
import type { CategoryOption, HabitDetail, SessionUser } from '@/lib/types';
import type { Person } from '@/lib/userColors';
import PersonLabel from '@/components/PersonLabel';
import LogButtonIcon from '@/components/logging/LogButtonIcon';
import LogEntrySheet from '@/components/logging/LogEntrySheet';
import { useHabitLogger } from '@/components/logging/useHabitLogger';
import ShareDialog from './ShareDialog';
import HabitDetails from './HabitDetails';
import { useCsvImport } from './useCsvImport';

// Values for the habit's form from the address bar (e.g. a shortcut or automation), as their
// fields' types. Read through useSearchParams rather than window.location, which still holds the
// previous page's URL when this renders during a client-side navigation (e.g. the redirect back
// here after logging in).
function prefillFrom(searchParams: URLSearchParams, properties: HabitFormProperties | undefined) {
  const data: Record<string, unknown> = {};
  searchParams.forEach((val, key) => {
    const prop = properties?.[key];
    if (!prop) return;
    data[key] = prop.type === 'number' || prop.type === 'integer' ? Number(val) : prop.type === 'boolean' ? val === 'true' : val;
  });
  return data;
}

// The top of a habit's page: its header and menu, and the Log Habit button, which logs a habit with
// no form on the tap or opens the entry sheet for one with a form (see useHabitLogger). The habit's
// history comes in as `children`, below the button.
export default function LogClient({ habit, user, people, categories, children }: { habit: HabitDetail, user: SessionUser, people: Record<string, Person>, categories: CategoryOption[], children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [shareOpen, setShareOpen] = useState(false);

  const sharedWith = habit.memberIds.filter(id => id !== habit.userId);

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

  const [prefill] = useState(() => prefillFrom(searchParams, parseHabitSchema(habit.schema).properties as HabitFormProperties | undefined));

  // Logging happens here in place. Afterwards the address bar is cleared of prefill values (and of
  // the history's paging, which starts over at the new entry), so a refresh doesn't fill them in again.
  const logger = useHabitLogger(habit, {
    initialData: prefill,
    onLogged: () => {
      if (window.location.search) window.history.replaceState(null, '', pathname);
    },
  });

  // Opened with values for the form (e.g. a shortcut, or something said on the dashboard that needs
  // finishing): show them in the entry sheet, ready to check and log. A "submit URL" (the prefill
  // URL plus `submit=1`) logs them as soon as the page opens instead. The ref guards against Strict
  // Mode running this twice, and `submit` is stripped from the address bar first so a refresh or
  // back-navigation doesn't log a second entry.
  const prefillHandled = useRef(false);
  useEffect(() => {
    if (prefillHandled.current) return;
    prefillHandled.current = true;

    if (searchParams.get('submit') !== '1') {
      if (Object.keys(prefill).length > 0) logger.openSheet();
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete('submit');
    // Deferred a tick: on a full page load this effect runs before the app router's own mount effects,
    // which would otherwise write the original URL (still with `submit`) back over this one.
    setTimeout(() => window.history.replaceState(null, '', params.size ? `${pathname}?${params}` : pathname));

    if (!logger.isComplete(prefill)) {
      toast.error('Submit URL is missing required fields. Please complete the form.');
      logger.openSheet();
      return;
    }
    logger.logEntry(prefill, { source: 'From a submit link' });
    // Only ever runs on the initial mount, with the formData prefilled from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Something the user said or typed on the dashboard that this habit was just created from (see
  // SmartEntry and RefineClient), to log as its first entry: filled in the same way as voice
  // logging, or, for a habit with no fields, logged straight away.
  useEffect(() => {
    const transcript = takePendingSmartEntry(habit.id);
    if (!transcript) return;

    const source = `From “${transcript}”`;
    if (!logger.hasForm) {
      logger.logEntry({}, { source });
      return;
    }
    const toastId = toast.loading('AI is filling in your entry...');
    parseVoiceLog(habit.schema, transcript, habit.aiContext)
      .then(async result => {
        if (result.success && result.data) await logger.fillIn(result.data, source, toastId);
        else toast.error(result.error || 'AI could not understand', { id: toastId });
      })
      .catch(() => toast.error('Failed to connect to AI', { id: toastId }));
    // Only ever runs on the initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { importInputRef, importing, handleImportCsv } = useCsvImport(habit.id, () => router.refresh());
  const formData = logger.formData;

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

      <div className="p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6 sm:space-y-8">
        {habit.description && <p className="text-stone-600 text-center">{habit.description}</p>}

        <HabitDetails habit={habit} categories={categories} />

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

        {/* Split like the dashboard's smart entry button: log now, or pick an earlier date and time */}
        <div className="flex">
          <Button size="xl" onClick={logger.start} disabled={logger.busy} className="flex-1 rounded-r-none">
            <LogButtonIcon hasForm={logger.hasForm} busy={logger.busy} size="lg" />
            {logger.busy ? 'Logging...' : 'Log Habit'}
          </Button>
          <Button
            size="xl"
            onClick={() => logger.openSheet({ backdate: true })}
            disabled={logger.busy}
            title="Backdate log"
            aria-label="Backdate log"
            className="rounded-l-none px-5! border-l border-emerald-700"
          >
            <History className="w-6 h-6" strokeWidth={2.5} />
          </Button>
        </div>

        {children}
      </div>

      {logger.sheetOpen && <LogEntrySheet logger={logger} />}
    </div>
  );
}
