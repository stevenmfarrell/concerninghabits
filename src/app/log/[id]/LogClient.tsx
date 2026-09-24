'use client';

import { useState, useRef, useEffect } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { logHabitEvent, deleteHabitLog } from '../../actions/db';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, Undo2 } from 'lucide-react';
import Link from 'next/link';

export default function LogClient({ habit }: { habit: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [createdLogId, setCreatedLogId] = useState<string | null>(null);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [logDate, setLogDate] = useState('');
  const [showBackdate, setShowBackdate] = useState(false);

  const schema = JSON.parse(habit.schema);

  const [formData, setFormData] = useState<any>({});

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

  const handleManualSubmit = async () => {
    try {
      setLoading(true);
      
      let createdAt = undefined;
      if (logDate) {
        createdAt = new Date(logDate);
      }
      
      const log = await logHabitEvent(habit.id, formData || {}, createdAt);
      setCreatedLogId(log.id);
      setSuccess(true);
      
      redirectTimeoutRef.current = setTimeout(() => {
        router.refresh();
        router.push('/');
      }, 4000); // 4 seconds gives them time to hit undo
    } catch (err: any) {
      alert(`Failed to log entry: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!createdLogId) return;
    
    // Stop the automatic redirect
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
    
    try {
      setUndoing(true);
      await deleteHabitLog(createdLogId, habit.id);
      setSuccess(false);
      setCreatedLogId(null);
    } catch (err: any) {
      alert(`Failed to undo: ${err.message}`);
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-stone-900">{habit.name}</h1>
        {habit.description && <p className="text-stone-600 mt-2">{habit.description}</p>}
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100">
        {success ? (
          <div className="text-center py-8 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-stone-800 mb-2">Logged!</h2>
            <p className="text-stone-500 mb-8">Redirecting to dashboard...</p>
            
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoing}
              className="inline-flex items-center gap-2 px-6 py-3 text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl font-medium transition-colors disabled:opacity-70 cursor-pointer"
            >
              {undoing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Undo2 className="w-5 h-5" />}
              {undoing ? 'Undoing...' : 'Undo Entry'}
            </button>
          </div>
        ) : (
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
        )}
      </div>

      <div className="flex items-center justify-center gap-6 pt-4">
        <Link href="/" className="text-sm font-medium text-stone-500 hover:text-stone-800 transition-colors">
          Dashboard
        </Link>
        <span className="text-stone-300">&bull;</span>
        <Link href={`/history/${habit.id}`} className="text-sm font-medium text-stone-500 hover:text-stone-800 transition-colors">
          History
        </Link>
      </div>
    </div>
  );
}
