'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { exportHabitLogsCsv } from '../../actions/db';
import toast from 'react-hot-toast';

export default function ExportCsvButton({ habitId }: { habitId: string }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { filename, csv } = await exportHabitLogsCsv(habitId);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(`Failed to export CSV: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IconButton onClick={handleExport} disabled={loading} title="Export CSV">
      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" strokeWidth={2.5} />}
    </IconButton>
  );
}
