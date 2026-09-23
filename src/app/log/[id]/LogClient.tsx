'use client';

import { useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { logHabitEvent } from '../../actions/db';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function LogClient({ habit }: { habit: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Backdate functionality
  // Default to empty (which means 'now'), but allow user to select a date/time
  const [logDate, setLogDate] = useState('');
  const [showBackdate, setShowBackdate] = useState(false);

  const schema = JSON.parse(habit.schema);

  const handleSubmit = async (data: any) => {
    setLoading(true);
    
    // Parse the backdated time if provided
    let createdAt = undefined;
    if (logDate) {
      createdAt = new Date(logDate);
    }
    
    await logHabitEvent(habit.id, data.formData || {}, createdAt);
    setSuccess(true);
    setLoading(false);
    
    // Redirect back to dashboard after a short delay
    setTimeout(() => {
      router.push('/');
    }, 1500);
  };

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-stone-900">{habit.name}</h1>
        {habit.description && <p className="text-stone-600 mt-2">{habit.description}</p>}
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100">
        {success ? (
          <div className="text-center py-8 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-semibold text-stone-800">Logged Successfully!</h2>
            <p className="text-stone-500">Redirecting...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="prose max-w-none">
              <Form 
                schema={schema} 
                validator={validator} 
                onSubmit={handleSubmit}
                disabled={loading}
                className="space-y-6 rjsf"
              >
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
                    type="submit" 
                    disabled={loading}
                    className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium text-lg hover:bg-emerald-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-70 shadow-sm"
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
              </Form>
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
