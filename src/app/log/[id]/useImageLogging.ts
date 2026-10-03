'use client';

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { parseImageLog } from '../../actions/habit';

// `source` describes where the data came from, for the logged-entry toast
type OnExtracted = (data: Record<string, unknown>, loadingToastId: string, source: string) => void | Promise<void>;

// Server Action request bodies are capped at 1MB, and a full-size phone photo is several MB once
// base64-encoded. Downscaling to this size keeps uploads to a few hundred KB, which is still plenty
// for the model to read a treadmill screen or a handwritten log.
const MAX_IMAGE_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;

// Decode the picked file, downscale it so its longest side is at most MAX_IMAGE_DIMENSION, and
// re-encode it as a JPEG data URL.
async function resizeImageToDataUrl(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}

// Photo logging: shrink the picked image, send it to the AI parser, and hand any extracted
// fields to `onExtracted`.
export function useImageLogging(habitSchema: string, aiContext: string | null, onExtracted: OnExtracted) {
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
      let dataUrl: string;
      try {
        dataUrl = await resizeImageToDataUrl(file);
      } catch {
        toast.error('Failed to read image file', { id: loadingToast });
        return;
      }

      const result = await parseImageLog(habitSchema, dataUrl, aiContext);
      if (result.success && result.data) {
        await onExtracted(result.data, loadingToast, 'From your photo');
      } else {
        toast.error(result.error || 'AI could not analyze the image', { id: loadingToast });
      }
    } catch {
      toast.error('Failed to process image', { id: loadingToast });
    } finally {
      setIsProcessing(false);
    }
  };

  return { fileInputRef, isProcessing, handleImageUpload };
}
