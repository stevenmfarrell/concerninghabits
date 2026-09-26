import React from 'react';
import { WidgetProps } from '@rjsf/utils';

export default function UnitWidget(props: WidgetProps) {
  const { value, onChange, disabled, readonly, id, schema } = props;
  
  // The AI stores the unit in x-unit
  const unit = schema['x-unit'] || '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === '') {
      onChange(undefined);
    } else {
      onChange(parseFloat(e.target.value));
    }
  };

  return (
    <div className="relative flex items-center">
      <input
        id={id}
        type="number"
        step="any"
        className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-stone-900 transition-shadow pr-16"
        value={value ?? ''}
        onChange={handleChange}
        disabled={disabled || readonly}
      />
      {unit && (
        <span className="absolute right-4 text-stone-400 font-medium pointer-events-none">
          {unit}
        </span>
      )}
    </div>
  );
}
