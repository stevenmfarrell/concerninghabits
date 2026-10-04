import { getDefaultUser } from '@/app/actions/db';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import ProvisionUserForm from './ProvisionUserForm';
import DeleteUserButton from './DeleteUserButton';
import { Shield } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage, PaneSection } from '@/components/Pane';

export default async function UsersSettingsPage() {
  const currentUser = await getDefaultUser();

  if (!currentUser.isAdmin) {
    redirect('/');
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    omit: { passwordHash: true }
  });

  return (
    <PanePage width="3xl" header={<PageHeader title="Family Users" backHref="/settings" />}>
      <PaneSection title="Users">
        {users.map(user => (
          <div key={user.id} className={`${PANE_INSET} py-3 flex items-center justify-between gap-3`}>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink truncate">{user.name}</span>
                {user.isAdmin && (
                  <Shield className="w-3.5 h-3.5 text-accent-ink shrink-0" aria-label="Admin" />
                )}
              </div>
              <span className="text-sm text-ink-muted">ID: {user.id.slice(0, 8)}...</span>
            </div>
            {user.id !== currentUser.id && (
              <DeleteUserButton userId={user.id} userName={user.name} />
            )}
          </div>
        ))}
        <ProvisionUserForm />
      </PaneSection>
    </PanePage>
  );
}
