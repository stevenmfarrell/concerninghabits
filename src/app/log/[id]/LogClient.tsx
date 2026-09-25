'use client';

import { useState, useRef, useEffect } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { logHabitEvent, deleteHabitLog } from '../../actions/db';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, Undo2, Link2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function LogClient({ habit }: { habit: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [logDate, setLogDate] = useState('');
  const [showBackdate, setShowBackdate] = useState(false);

  const schema = JSON.parse(habit.schema);

  const [formData, setFormData] = useState<any>({});

  const handleManualSubmit = async () => {
    try {
      setLoading(true);

      let createdAt = undefined;
      if (logDate) {
        createdAt = new Date(logDate);
      }

      const log = await logHabitEvent(habit.id, formData || {}, createdAt);

      toast.success((t) => (
        <div className="flex items-center gap-4">
          <span className="font-semibold whitespace-nowrap">{habit.name} Logged</span>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await deleteHabitLog(log.id, habit.id);
                toast.success("Entry undone");
                router.refresh(); // Refresh to remove the undone item
              } catch (err: any) {
                toast.error(`Failed to undo: ${err.message}`);
              }
            }}
            className="px-3 py-1 text-sm font-semibold text-stone-900 bg-white hover:bg-stone-200 rounded-lg transition-colors ml-2 shadow-sm"
          >
            Undo
          </button>
        </div>
      ), { duration: 6000 });

      router.push(`/history/${habit.id}`);
    } catch (err: any) {
      toast.error(`Failed to log entry: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Initialize formData from URL search params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const initialData: any = {};
      params.forEach((val, key) => {
        const propSchema = schema.properties?.[key];
        if (propSchema) {
          if (propSchema.type === 'number' || propSchema.type === 'integer') {
            initialData[key] = Number(val);
          } else if (propSchema.type === 'boolean') {
            initialData[key] = val === 'true';
          } else {
            initialData[key] = val;
          }
        }
      });
      if (Object.keys(initialData).length > 0) {
        setFormData(initialData);
      }
    }
  }, []);

  const handleCopyUrl = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.search = '';

    Object.entries(formData).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.set(key, String(val));
      }
    });

    navigator.clipboard.writeText(url.toString());
    toast.success('Automation URL copied to clipboard!');
  };

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">{habit.name}</h1>
          {habit.description && <p className="text-stone-600 mt-2">{habit.description}</p>}
        </div>
        <button
          onClick={handleCopyUrl}
          title="Copy URL for NFC automation"
          className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors shrink-0"
        >
          <Link2 className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100">
        <div className="space-y-6">
          <div className="rjsf-custom">
            <Form
              schema={schema}
              validator={validator}
              formData={formData}
              onChange={(e) => setFormData(e.formData)}
              disabled={loading}
              noHtml5Validate={true}
              showErrorList={false}
              className="space-y-6 rjsf"
            >
              <></>
            </Form>
            <div className="space-y-4 pt-4">
              {showBackdate && (
                <div className="animate-in fade-in slide-in-from-bottom-2 p-4 bg-stone-50 border border-stone-200 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-stone-700">
                      Custom Date & Time
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBackdate(false);
                        setLogDate('');
                      }}
                      className="text-xs text-stone-500 hover:text-stone-700 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-stone-700 text-sm"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </div>
              )}

              <button
                type="button"
                disabled={loading}
                onClick={(e) => {
                  e.preventDefault();
                  handleManualSubmit();
                }}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium text-lg hover:bg-emerald-700 cursor-pointer transition-colors flex justify-center items-center gap-2 disabled:opacity-70 shadow-sm"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {loading ? 'Logging...' : 'Log Event'}
              </button>

              {!showBackdate && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowBackdate(true)}
                    className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    Backdate log
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
