import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = true,
  isProcessing = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog label={title}>
      <div className="p-6 sm:p-8 space-y-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full shrink-0 ${isDestructive ? 'bg-danger-soft-strong text-danger-ink' : 'bg-accent-soft-strong text-accent-ink'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-ink">{title}</h3>
            <p className="text-ink-muted leading-relaxed">
              {message}
            </p>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={isProcessing}
          className="w-full sm:w-auto"
        >
          {cancelText}
        </Button>
        <Button
          variant={isDestructive ? 'danger' : 'primary'}
          onClick={onConfirm}
          disabled={isProcessing}
          className="w-full sm:w-auto"
        >
          {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
          {confirmText}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
