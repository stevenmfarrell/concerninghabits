import { describe, expect, it } from 'vitest';
import { habitFormUiSchema } from '@/components/widgets/habitForm';

describe('habitFormUiSchema', () => {
  it('renders a textarea field as a multi-line text box, and leaves plain text fields alone', () => {
    const uiSchema = habitFormUiSchema({
      notes: { type: 'string', title: 'Notes', 'x-widget': 'textarea' },
      place: { type: 'string', title: 'Place' },
      time: { type: 'number', 'x-widget': 'duration' },
    });
    expect(uiSchema.notes).toEqual({ 'ui:widget': 'textarea', 'ui:options': { rows: 4 } });
    expect(uiSchema.place).toBeUndefined();
    expect(uiSchema.time).toEqual({ 'ui:widget': 'duration' });
  });
});
