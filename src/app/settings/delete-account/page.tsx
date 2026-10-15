import { FileJson, FileSpreadsheet } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage, PaneSection } from '@/components/Pane';
import { buttonClasses } from '@/components/ui/Button';
import { getDefaultUser } from '@/app/actions/user';
import { selfDeletionProblem } from '@/lib/accounts';
import DeleteAccountForm from './DeleteAccountForm';

// Deleting your own account and everything in it (see deleteAccount), offering a backup first
export default async function DeleteAccountPage() {
  const user = await getDefaultUser();
  const problem = await selfDeletionProblem(user);

  return (
    <PanePage width="3xl" header={<PageHeader title="Delete Account" backHref="/settings" />}>
      <div className={`${PANE_INSET} py-3 space-y-3 text-ink-muted`}>
        <p>Deleting your account deletes everything in it, for good:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your habits, categories, entries, skips, vacations and preferences.</li>
          <li>Habits you shared, for everyone you shared them with, along with their entries on them.</li>
          <li>Your entries on habits others shared with you.</li>
          <li>Your connections, invites, API keys and reminders.</li>
        </ul>
        <p>It can&apos;t be undone.</p>
      </div>

      <PaneSection title="Download a Backup First">
        <div className={`${PANE_INSET} py-4 flex flex-wrap gap-3`}>
          <a href="/api/backup?format=json" download className={buttonClasses('outline')}>
            <FileJson className="w-5 h-5" />
            JSON
          </a>
          <a href="/api/backup?format=csv" download className={buttonClasses('outline')}>
            <FileSpreadsheet className="w-5 h-5" />
            CSV
          </a>
        </div>
      </PaneSection>
      <p className={`${PANE_INSET} py-3 text-sm text-ink-muted`}>
        A backup has the habits you own and your entries on them, to restore here or on any other server.
      </p>

      {problem
        ? <p className={`${PANE_INSET} py-4 text-sm text-ink-secondary`}>{problem}</p>
        : <DeleteAccountForm />}
    </PanePage>
  );
}
