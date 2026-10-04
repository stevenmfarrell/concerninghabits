'use client';

import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { deleteUser } from '@/app/actions/auth';
import toast from 'react-hot-toast';

import ConfirmDialog from '@/components/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';

export default function DeleteUserButton({ userId, userName }: { userId: string, userName: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const res = await deleteUser(userId);
    if (res?.error) {
      toast.error(res.error);
      setIsDeleting(false);
      setShowConfirm(false);
    } else {
      toast.success("User deleted");
      setShowConfirm(false);
    }
  };

  return (
    <>
      <IconButton
        onClick={() => setShowConfirm(true)}
        disabled={isDeleting}
        edge="right"
        title={`Delete ${userName}`}
        aria-label={`Delete ${userName}`}
      >
        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </IconButton>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Delete User"
        message={`Are you absolutely sure you want to delete ${userName}? This will permanently delete all of their habits, categories, and logs. This cannot be undone.`}
        confirmText="Delete User"
        isProcessing={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
