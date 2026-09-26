'use client';

import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { useRouter, useSearchParams } from 'next/navigation';

export default function HabitChart({ 
  logs, 
  numericFields,
  pageSize,
  habitId
}: { 
  logs: { id: string, createdAt: Date, payload: string }[], 
  numericFields: string[],
  pageSize: number,
  habitId: string
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedField, setSelectedField] = useState<string>(numericFields[0]);
  const [isOpen, setIsOpen] = useState(false);

  const data = useMemo(() => {
    // Parse payloads and extract the selected field
    const points = logs.map(log => {
      try {
        const payload = JSON.parse(log.payload);
        const val = payload[selectedField];
        return {
          logId: log.id,
          date: new Date(log.createdAt).getTime(), // Sort by time
          dateStr: new Date(log.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          value: typeof val === 'number' ? val : null
        };
      } catch (e) {
        return { logId: log.id, date: new Date(log.createdAt).getTime(), dateStr: '', value: null };
      }
    });

    // Filter out nulls and sort chronologically (oldest to newest)
    return points
      .filter(p => p.value !== null)
      .sort((a, b) => a.date - b.date);
  }, [logs, selectedField]);

  if (numericFields.length === 0) return null;

  const hasData = data.length > 0;

  const handleChartClick = (e: any) => {
    // This catches clicks anywhere on the chart's vertical slice
    if (e && e.activePayload && e.activePayload.length > 0) {
      triggerHighlight(e.activePayload[0].payload.logId);
    }
  };

  const handleDotClick = (e: any) => {
    // This catches direct clicks on the active dot
    if (e && e.payload && e.payload.logId) {
      triggerHighlight(e.payload.logId);
    }
  };

  const triggerHighlight = (clickedLogId: string) => {
    if (!clickedLogId) return;

    const index = logs.findIndex(l => l.id === clickedLogId);
    const page = index !== -1 ? Math.floor(index / pageSize) + 1 : 1;
    
    // We append a timestamp so that even if you click the SAME dot twice, the URL changes and the animation re-triggers
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    params.set('highlight', clickedLogId);
    params.set('t', Date.now().toString());
    
    router.push(`/history/${habitId}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col mt-6">
      <div className="flex w-full items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-stone-800">Trends</h2>
        
        {numericFields.length > 1 && (
          <div className="relative">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg text-sm font-medium text-stone-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {selectedField.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}
              <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {isOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-48 bg-white border border-stone-100 rounded-xl shadow-lg z-50 overflow-hidden py-1">
                  {numericFields.map(field => (
                    <button
                      key={field}
                      onClick={() => {
                        setSelectedField(field);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        selectedField === field ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {field.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {numericFields.length === 1 && (
          <span className="text-sm font-medium text-stone-500 bg-stone-100 px-3 py-1 rounded-lg">
            {selectedField.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}
          </span>
        )}
      </div>

      <div className="w-full h-64">
        {!hasData ? (
          <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm italic">
            No data recorded for this metric yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }} onClick={handleChartClick} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent', userSelect: 'none', outline: 'none' }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
              <XAxis 
                dataKey="dateStr" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#78716c', fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#78716c', fontSize: 12 }}
              />
              <Tooltip 
                cursor={false}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e7e5e4', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ color: '#57534e', fontWeight: 600, marginBottom: '4px' }}
                itemStyle={{ color: '#047857', fontWeight: 700 }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                name="Value"
                stroke="#059669" 
                strokeWidth={3}
                dot={{ r: 4, fill: '#059669', strokeWidth: 0, onClick: handleDotClick }}
                activeDot={{ r: 6, fill: '#047857', stroke: '#fff', strokeWidth: 2, onClick: handleDotClick }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
