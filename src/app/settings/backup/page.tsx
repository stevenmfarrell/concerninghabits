import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage } from '@/components/Pane';
import BackupClient from './BackupClient';

// Backup & Restore: download everything of yours as JSON or CSV, and restore from either (see
// src/lib/backup.ts)
export default function BackupPage() {
  return (
    <PanePage width="3xl" header={<PageHeader title="Backup & Restore" backHref="/settings" />}>
      <p className={`${PANE_INSET} py-3 text-ink-muted`}>
        A backup has your categories, the habits you own with their forms, charts and cadences, your entries on them, skips, vacations and preferences. Habits someone shared with you are theirs to back up.
      </p>
      <BackupClient />
    </PanePage>
  );
}
