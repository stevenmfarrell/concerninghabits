'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { parseVoiceLog } from '../../actions/habit';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, Loader2, Link2, MoreVertical, Pencil, Upload, Users, FolderInput, Zap } from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage } from '@/components/Pane';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import toast from 'react-hot-toast';
import { parseHabitSchema, type HabitFormProperties } from '@/components/widgets/habitForm';
import { takePendingSmartEntry } from '@/lib/pendingSmartEntry';
import type { CategoryOption, HabitDetail, SessionUser } from '@/lib/types';
import type { Person } from '@/lib/userColors';
import type { ReminderStatus } from '@/lib/reminders';
import type { SkipState } from '@/lib/cadence';
import PersonLabel from '@/components/PersonLabel';
import LogButtonIcon from '@/components/logging/LogButtonIcon';
import LogEntrySheet from '@/components/logging/LogEntrySheet';
import { useHabitLogger } from '@/components/logging/useHabitLogger';
import ShareDialog from './ShareDialog';
import SkipButton from './SkipButton';
import HabitDetails from './HabitDetails';
import { useCsvImport } from './useCsvImport';
import { MENU_ITEM, MENU_PANEL, MenuBackdrop } from '@/components/ui/Menu';

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
// no form on the tap or opens the entry sheet for one with a form (see useHabitLogger), with a way to
// skip it under it while it's due (`skip`, see skipState). The habit's
// history comes in as `children`, below the button: sections of the page's pane.
export default function LogClient({ habit, user, people, categories, reminder, skip, children }: { habit: HabitDetail, user: SessionUser, people: Record<string, Person>, categories: CategoryOption[], reminder: { status: ReminderStatus; hasDevice: boolean } | null, skip: SkipState | null, children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [shareOpen, setShareOpen] = useState(false);

  const sharedWith = habit.memberIds.filter(id => id !== habit.userId);

  const [menuOpen, setMenuOpen] = useState(false);

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
    <PanePage header={
      <PageHeader
        title={<span className="truncate">{habit.name}</span>}
        actions={
          <>
            <IconButton onClick={() => setMenuOpen(!menuOpen)} edge="right" title="More options">
              <MoreVertical className="w-6 h-6" />
            </IconButton>

            {menuOpen && (
              <>
                <MenuBackdrop onClose={() => setMenuOpen(false)} />
                <div className={`${MENU_PANEL} absolute right-0 top-full mt-1 w-56`}>
                  {/* Someone a habit is shared with can't edit it, only file it or remove it from their lists */}
                  <Link
                    href={`/edit/${habit.id}`}
                    className={MENU_ITEM}
                  >
                    {habit.isOwner ? <Pencil className="w-4 h-4" /> : <FolderInput className="w-4 h-4" />}
                    {habit.isOwner ? 'Edit Habit' : 'Move or Remove'}
                  </Link>
                  {habit.isOwner && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setShareOpen(true);
                      }}
                      className={MENU_ITEM}
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
                    className={MENU_ITEM}
                  >
                    <Link2 className="w-4 h-4" />
                    Copy URL
                  </button>
                  <button
                    onClick={() => {
                      handleCopyUrl(true);
                      setMenuOpen(false);
                    }}
                    className={MENU_ITEM}
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
                    className={`${MENU_ITEM} disabled:opacity-50`}
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
    }>
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

      <div className={`${PANE_INSET} py-4 space-y-6`}>
        {habit.description && <p className="text-ink-secondary text-center">{habit.description}</p>}

        <HabitDetails habit={habit} categories={categories} reminder={reminder} bedtime={user.bedtime} />

        {habit.isOwner && sharedWith.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 -mt-2 text-xs text-ink-muted">
            <span>Shared with</span>
            {sharedWith.map(id => <PersonLabel key={id} person={people[id]} />)}
          </div>
        )}
        {!habit.isOwner && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 -mt-2 text-xs text-ink-muted">
            <span>Shared by</span>
            <PersonLabel person={people[habit.userId]} />
          </div>
        )}

        <div className="space-y-2">
          {/* Split like the Agenda page's smart entry button: log now, or pick an earlier time */}
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
              className="rounded-l-none px-5! border-l border-accent-hover"
            >
              <CalendarClock className="w-6 h-6" strokeWidth={2.5} />
            </Button>
          </div>
          {skip && <SkipButton habitId={habit.id} skip={skip} />}
        </div>
      </div>

      {children}

      {logger.sheetOpen && <LogEntrySheet logger={logger} />}
    </PanePage>
  );
}
