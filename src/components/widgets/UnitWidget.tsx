import React from 'react';
import { WidgetProps } from '@rjsf/utils';
import { INPUT } from '@/components/ui/Input';

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
        className={`${INPUT} pr-16`}
        value={value ?? ''}
        onChange={handleChange}
        disabled={disabled || readonly}
      />
      {unit && (
        <span className="absolute right-4 text-ink-subtle font-medium pointer-events-none">
          {unit}
        </span>
      )}
    </div>
  );
}
