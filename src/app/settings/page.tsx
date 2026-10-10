import { getDefaultUser } from '../actions/db';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Bell, ChevronRight, FolderTree, Users, Sliders, LogOut, KeyRound } from 'lucide-react';
import Icon from '../../components/Icon';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage, PaneSection } from '@/components/Pane';

// A row's icon and text, shared by the link rows and the Log Out button row
function RowContent({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center text-accent-ink group-hover:bg-accent-soft-strong transition-colors shrink-0">
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-semibold text-ink text-lg truncate">{title}</span>
        {description && <span className="text-sm text-ink-muted truncate">{description}</span>}
      </div>
    </div>
  );
}

const ROW = `flex items-center justify-between gap-3 ${PANE_INSET} py-3 hover:bg-surface-subtle transition-colors group`;

function SettingsLink({ href, ...content }: { href: string; icon: ReactNode; title: string; description?: string }) {
  return (
    <Link href={href} className={ROW}>
      <RowContent {...content} />
      <ChevronRight className="w-5 h-5 text-ink-subtle group-hover:text-ink-secondary transition-colors shrink-0" />
    </Link>
  );
}

export default async function SettingsPage() {
  const user = await getDefaultUser();

  return (
    <PanePage width="3xl" header={<PageHeader title="Settings" showBack={false} />}>
      <div className={`${PANE_INSET} py-4 flex items-center gap-4`}>
        <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center shrink-0 border border-line">
          <Icon name="User" className="w-8 h-8 text-ink-subtle" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-ink truncate">{user.name}</h2>
          <p className="text-ink-muted text-sm truncate">{user.email}</p>
          {user.isAdmin && (
            <span className="inline-block mt-1 px-2 py-0.5 bg-accent-soft-strong text-accent-ink-strong text-[10px] font-bold rounded-md uppercase tracking-wider">
              Admin
            </span>
          )}
        </div>
      </div>

      <PaneSection title="Preferences">
        <SettingsLink href="/settings/preferences" icon={<Sliders className="w-5 h-5" />} title="Personal Preferences" description="Theme, bedtime, calendar start day, emojis" />
        <SettingsLink href="/settings/reminders" icon={<Bell className="w-5 h-5" />} title="Reminders" description="Nudges when you're running late on a habit" />
        <SettingsLink href="/settings/categories" icon={<FolderTree className="w-5 h-5" />} title="Manage Categories" />
        {user.isAdmin && (
          <SettingsLink href="/settings/users" icon={<Users className="w-5 h-5" />} title="Family Users" description="Add or remove family members" />
        )}
      </PaneSection>

      <PaneSection title="Account">
        <SettingsLink href="/update-password" icon={<KeyRound className="w-5 h-5" />} title="Change Password" />
        {/* A row like the others rather than a Button, so it reads as part of the list */}
        <form action={async () => {
          'use server';
          const { logout } = await import('../actions/auth');
          await logout();
        }}>
          <button type="submit" className={`${ROW} w-full text-left`}>
            <RowContent icon={<LogOut className="w-5 h-5" />} title="Log Out" />
          </button>
        </form>
      </PaneSection>
    </PanePage>
  );
}
