'use client';

import { useState, useRef, useEffect } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { logHabitEvent, deleteHabitLog } from '../../actions/db';
import { parseVoiceLog, parseImageLog } from '../../actions/habit';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, Undo2, Link2, Mic, MicOff, Camera } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DurationWidget from '../../../components/widgets/DurationWidget';
import { formatLogValue } from '../../../lib/format';

export default function LogClient({ habit }: { habit: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [logDate, setLogDate] = useState('');
  const [showBackdate, setShowBackdate] = useState(false);
  const [aiSuccessLog, setAiSuccessLog] = useState<{ logId: string, data: any } | null>(null);

  const schema = JSON.parse(habit.schema);
  
  // Build uiSchema for custom widgets
  const uiSchema: any = {};
  if (schema.properties) {
    Object.keys(schema.properties).forEach(key => {
      if (schema.properties[key]['x-widget'] === 'duration') {
        uiSchema[key] = { 'ui:widget': 'duration' };
      }
    });
  }

  const [formData, setFormData] = useState<any>({});
  
  const recognitionRef = useRef<any>(null);
  const splashTimeoutRef = useRef<any>(null);
  
  const [timeLeft, setTimeLeft] = useState(100);

  useEffect(() => {
    if (aiSuccessLog) {
      const timer = setTimeout(() => setTimeLeft(0), 50);
      return () => clearTimeout(timer);
    } else {
      setTimeLeft(100);
    }
  }, [aiSuccessLog]);

  useEffect(() => {
    return () => {
      if (splashTimeoutRef.current) clearTimeout(splashTimeoutRef.current);
    };
  }, []);

  const handleAiExtractionSuccess = async (extractedData: any, loadingToastId: string) => {
    if (Object.keys(extractedData).length === 0) {
      toast.error('Could not find any relevant data.', { id: loadingToastId });
      return;
    }

    const newFormData = { ...formData, ...extractedData };
    setFormData(newFormData);

    const requiredFields = schema.required || [];
    const isFilled = requiredFields.every((field: string) => 
      newFormData[field] !== undefined && newFormData[field] !== null && newFormData[field] !== ''
    );

    if (isFilled) {
      toast.dismiss(loadingToastId);
      try {
        const log = await logHabitEvent(habit.id, newFormData, undefined);
        setAiSuccessLog({ logId: log.id, data: newFormData });
        splashTimeoutRef.current = setTimeout(() => {
          router.push(`/history/${habit.id}`);
        }, 6000);
      } catch (err) {
        toast.error('AI filled the form, but auto-submit failed.');
      }
    } else {
      toast.success('Form partially filled by AI. Please complete missing fields.', { id: loadingToastId });
    }
  };

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

  useEffect(() => {
    // Initialize speech recognition
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = async (event: any) => {
          const transcript = event.results[0][0].transcript;
          setIsListening(false);
          setAiLoading(true);
          const loadingToast = toast.loading('AI is processing your voice...');
          
          try {
            const result = await parseVoiceLog(habit.schema, transcript);
            if (result.success && result.data) {
              await handleAiExtractionSuccess(result.data, loadingToast);
            } else {
              toast.error(result.error || 'AI could not understand', { id: loadingToast });
            }
          } catch (e) {
            toast.error('Failed to connect to AI', { id: loadingToast });
          } finally {
            setAiLoading(false);
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
          if (event.error !== 'aborted') {
            toast.error(`Microphone error: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [habit.schema]);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      toast.error("Voice recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast('Listening...', { icon: '🎙️' });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be selected again if needed
    event.target.value = '';

    const loadingToast = toast.loading('AI is analyzing your photo...');
    setAiLoading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const result = await parseImageLog(habit.schema, base64String);
        
        if (result.success && result.data) {
          await handleAiExtractionSuccess(result.data, loadingToast);
        } else {
          toast.error(result.error || 'AI could not analyze the image', { id: loadingToast });
        }
        setAiLoading(false);
      };
      reader.onerror = () => {
        toast.error('Failed to read image file', { id: loadingToast });
        setAiLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      toast.error('Failed to process image', { id: loadingToast });
      setAiLoading(false);
    }
  };

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

  if (aiSuccessLog) {
    return (
      <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-white rounded-2xl shadow-sm border border-emerald-100">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 ring-8 ring-emerald-50">
            <Check className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Logged Successfully</h1>
          <p className="text-stone-500 mb-8">AI automatically submitted your entry</p>
          
          <div className="w-full bg-stone-50 rounded-xl p-4 text-left border border-stone-200 mb-8 max-h-64 overflow-y-auto">
            {Object.entries(aiSuccessLog.data).map(([key, val]) => {
              const label = schema.properties?.[key]?.title || key;
              return (
                <div key={key} className="flex justify-between items-center py-2 border-b border-stone-100 last:border-0">
                  <span className="text-sm font-medium text-stone-500">{label}</span>
                  <span className="text-sm font-semibold text-stone-900">{formatLogValue(val, schema.properties?.[key])}</span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={async () => {
                if (splashTimeoutRef.current) clearTimeout(splashTimeoutRef.current);
                try {
                  await deleteHabitLog(aiSuccessLog.logId, habit.id);
                  setAiSuccessLog(null);
                  toast.success("Entry undone. You can now edit.");
                } catch (e: any) {
                  toast.error(`Failed to undo: ${e.message}`);
                }
              }}
              className="flex-1 py-3 px-4 bg-white border-2 border-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
            >
              <Undo2 className="w-4 h-4" />
              Undo & Edit
            </button>
            <button
              onClick={() => {
                if (splashTimeoutRef.current) clearTimeout(splashTimeoutRef.current);
                router.push(`/history/${habit.id}`);
              }}
              className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
            >
              Continue
            </button>
          </div>
          
          <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mt-6">
            <div 
              className="h-full bg-emerald-500 ease-linear transition-all" 
              style={{ width: `${timeLeft}%`, transitionDuration: '6000ms' }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">{habit.name}</h1>
          {habit.description && <p className="text-stone-600 mt-2">{habit.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyUrl}
            title="Copy URL for NFC automation"
            className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors shrink-0"
          >
            <Link2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100">
        <div className="space-y-6">
          {Object.keys(schema.properties || {}).length > 0 && (schema.enableVoice !== false || schema.enablePhoto !== false) && (
            <div className={`grid gap-3 ${schema.enableVoice !== false && schema.enablePhoto !== false ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleImageUpload} 
              />
              {schema.enablePhoto !== false && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={aiLoading}
                  className="w-full py-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 transition-all font-semibold text-sm shadow-sm bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100 hover:border-blue-200"
                >
                  <Camera className="w-6 h-6" />
                  {aiLoading ? 'Processing...' : 'Photo Log'}
                </button>
              )}
              {schema.enableVoice !== false && (
                <button
                  onClick={toggleListen}
                  disabled={aiLoading}
                  className={`w-full py-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 transition-all font-semibold text-sm shadow-sm ${
                    isListening
                      ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
                      : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200'
                  }`}
                >
                  {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  {isListening ? 'Listening...' : 'Voice Log'}
                </button>
              )}
            </div>
          )}

          <div className="rjsf-custom">
            <Form
              schema={schema}
              uiSchema={uiSchema}
              widgets={{ duration: DurationWidget }}
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
