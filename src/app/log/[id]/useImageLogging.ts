'use client';

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { parseImageLog } from '../../actions/habit';

type OnExtracted = (data: Record<string, unknown>, loadingToastId: string) => void | Promise<void>;

// Photo logging: read the picked image as a data URL, send it to the AI parser, and hand any
// extracted fields to `onExtracted`.
export function useImageLogging(habitSchema: string, onExtracted: OnExtracted) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be selected again if needed
    event.target.value = '';

    const loadingToast = toast.loading('AI is analyzing your photo...');
    setIsProcessing(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const result = await parseImageLog(habitSchema, base64String);

        if (result.success && result.data) {
          await onExtracted(result.data, loadingToast);
        } else {
          toast.error(result.error || 'AI could not analyze the image', { id: loadingToast });
        }
        setIsProcessing(false);
      };
      reader.onerror = () => {
        toast.error('Failed to read image file', { id: loadingToast });
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Failed to process image', { id: loadingToast });
      setIsProcessing(false);
    }
  };

  return { fileInputRef, isProcessing, handleImageUpload };
}
