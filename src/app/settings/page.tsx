import { getDefaultUser } from '../actions/db';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, FolderTree, Users, Sliders, LogOut, KeyRound } from 'lucide-react';
import Icon from '../../components/Icon';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage, PaneSection } from '@/components/Pane';

// A row's icon and text, shared by the link rows and the Log Out button row
function RowContent({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors shrink-0">
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-semibold text-stone-800 text-lg truncate">{title}</span>
        {description && <span className="text-sm text-stone-500 truncate">{description}</span>}
      </div>
    </div>
  );
}

const ROW = `flex items-center justify-between gap-3 ${PANE_INSET} py-3 hover:bg-stone-50 transition-colors group`;

function SettingsLink({ href, ...content }: { href: string; icon: ReactNode; title: string; description?: string }) {
  return (
    <Link href={href} className={ROW}>
      <RowContent {...content} />
      <ChevronRight className="w-5 h-5 text-stone-400 group-hover:text-stone-600 transition-colors shrink-0" />
    </Link>
  );
}

export default async function SettingsPage() {
  const user = await getDefaultUser();

  return (
    <PanePage width="3xl" header={<PageHeader title="Settings" showBack={false} />}>
      <div className={`${PANE_INSET} py-4 flex items-center gap-4`}>
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center shrink-0 border border-stone-200">
          <Icon name="User" className="w-8 h-8 text-stone-400" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-stone-900 truncate">{user.name}</h2>
          <p className="text-stone-500 text-sm truncate">{user.email}</p>
          {user.isAdmin && (
            <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md uppercase tracking-wider">
              Admin
            </span>
          )}
        </div>
      </div>

      <PaneSection title="Preferences">
        <SettingsLink href="/settings/preferences" icon={<Sliders className="w-5 h-5" />} title="Personal Preferences" description="Bedtime, calendar start day, emojis" />
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
