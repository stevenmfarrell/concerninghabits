import React from 'react';
import { WidgetProps } from '@rjsf/utils';

export default function DurationWidget(props: WidgetProps) {
  const { value, onChange, disabled, readonly, id } = props;
  
  // value is a float number representing total minutes, e.g. 16.75
  const hrs = value !== undefined && value !== null ? Math.floor(value / 60) : '';
  const mins = value !== undefined && value !== null ? Math.floor(value % 60) : '';
  const secs = value !== undefined && value !== null ? Math.round((value - Math.floor(value)) * 60) : '';

  const getVals = () => {
    return {
      h: hrs === '' ? 0 : hrs as number,
      m: mins === '' ? 0 : mins as number,
      s: secs === '' ? 0 : secs as number
    };
  };

  const notifyChange = (h: number, m: number, s: number, isAllEmpty: boolean) => {
    if (isAllEmpty) {
      onChange(undefined);
    } else {
      onChange(h * 60 + m + s / 60);
    }
  };

  const handleHrsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { m, s } = getVals();
    if (e.target.value === '') {
      notifyChange(0, m, s, m === 0 && s === 0);
    } else {
      notifyChange(parseInt(e.target.value, 10), m, s, false);
    }
  };

  const handleMinsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { h, s } = getVals();
    if (e.target.value === '') {
      notifyChange(h, 0, s, h === 0 && s === 0);
    } else {
      notifyChange(h, parseInt(e.target.value, 10), s, false);
    }
  };

  const handleSecsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { h, m } = getVals();
    if (e.target.value === '') {
      notifyChange(h, m, 0, h === 0 && m === 0);
    } else {
      notifyChange(h, m, parseInt(e.target.value, 10), false);
    }
  };

  return (
    <div className="flex items-center gap-2 pb-6">
      <div className="relative">
        <input
          id={`${id}-hrs`}
          type="number"
          min="0"
          placeholder="0"
          className="w-16 sm:w-20 px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-stone-900 text-center font-medium"
          value={hrs}
          onChange={handleHrsChange}
          disabled={disabled || readonly}
        />
        <span className="absolute -bottom-5 left-0 w-full text-center text-xs text-stone-400 font-medium">hr</span>
      </div>
      <span className="text-stone-400 font-bold mb-5">:</span>
      <div className="relative">
        <input
          id={`${id}-mins`}
          type="number"
          min="0"
          placeholder="0"
          className="w-16 sm:w-20 px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-stone-900 text-center font-medium"
          value={mins}
          onChange={handleMinsChange}
          disabled={disabled || readonly}
        />
        <span className="absolute -bottom-5 left-0 w-full text-center text-xs text-stone-400 font-medium">min</span>
      </div>
      <span className="text-stone-400 font-bold mb-5">:</span>
      <div className="relative">
        <input
          id={`${id}-secs`}
          type="number"
          min="0"
          max="59"
          placeholder="0"
          className="w-16 sm:w-20 px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-stone-900 text-center font-medium"
          value={secs}
          onChange={handleSecsChange}
          disabled={disabled || readonly}
        />
        <span className="absolute -bottom-5 left-0 w-full text-center text-xs text-stone-400 font-medium">sec</span>
      </div>
    </div>
  );
}
