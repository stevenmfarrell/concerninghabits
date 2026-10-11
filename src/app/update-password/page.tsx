import { getDefaultUser } from '@/app/actions/user';
import UpdatePasswordForm from './UpdatePasswordForm';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage } from '@/components/Pane';

// Changing your password from Settings, or setting one before going on (e.g. a provisioned account's
// temporary password), which has nothing to go back to
export default async function UpdatePasswordPage() {
  const user = await getDefaultUser(true);
  const needsUpdate = user.passwordNeedsUpdate;

  return (
    <PanePage
      width="md"
      header={needsUpdate
        ? <PageHeader title="New Password" showBack={false} />
        : <PageHeader title="Change Password" backHref="/settings" />}
    >
      <p className={`${PANE_INSET} pt-4 text-sm text-ink-secondary`}>
        {needsUpdate
          ? `Welcome, ${user.name}! Set a new password for your account to continue.`
          : 'Enter your current password, then the new one twice.'}
      </p>
      <UpdatePasswordForm needsUpdate={needsUpdate} />
    </PanePage>
  );
}
