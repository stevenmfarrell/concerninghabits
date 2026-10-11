import { getDefaultUser } from '@/app/actions/user';
import { getVacation } from '@/app/actions/vacation';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage } from '@/components/Pane';
import { todayKeyFor } from '@/lib/timezone';
import VacationForm from './VacationForm';

// Vacation: time away when nothing's due. While it's on, every habit and category counts as skipped
// each day, so nothing's held against its health and reminders pause; it can be ended early from
// here or the Agenda.
export default async function VacationPage() {
  const [user, vacation] = await Promise.all([getDefaultUser(), getVacation()]);
  const today = vacation?.today ?? todayKeyFor(user);

  return (
    <PanePage width="3xl" header={<PageHeader title="Vacation" backHref="/settings" />}>
      <p className={`${PANE_INSET} py-3 text-ink-muted`}>
        While you&apos;re away, every habit and category counts as skipped: nothing&apos;s due, nothing counts against its health, and reminders pause. Anything you log still counts.
      </p>
      <VacationForm vacation={vacation} today={today} />
    </PanePage>
  );
}
