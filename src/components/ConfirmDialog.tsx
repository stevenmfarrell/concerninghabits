import { AlertTriangle, Loader2 } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 sm:p-8 space-y-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shrink-0 ${isDestructive ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-stone-900">{title}</h3>
              <p className="text-stone-500 leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 sm:px-8 sm:py-6 bg-stone-50 border-t border-stone-100 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-5 py-2.5 text-stone-600 font-medium hover:bg-stone-200 rounded-xl transition-colors disabled:opacity-50 w-full sm:w-auto"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-5 py-2.5 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 w-full sm:w-auto ${
              isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
            } disabled:opacity-50`}
          >
            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
