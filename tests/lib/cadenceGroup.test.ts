import { describe, expect, it } from 'vitest';
import { cadenceGroup } from '@/components/CadenceField';

describe('cadenceGroup', () => {
  it('offers every 7 days as weekly and every 30 as monthly, other N-day cadences on their own', () => {
    expect(cadenceGroup({ type: 'everyNDays', days: 7 })).toBe('weekly');
    expect(cadenceGroup({ type: 'everyNDays', days: 30 })).toBe('monthly');
    expect(cadenceGroup({ type: 'everyNDays', days: 3 })).toBe('everyNDays');
    expect(cadenceGroup({ type: 'everyNDays', days: 14 })).toBe('everyNDays');
  });

  it('puts calendar weeks and certain days under weekly, calendar months under monthly', () => {
    expect(cadenceGroup({ type: 'calendarWeek', times: 3 })).toBe('weekly');
    expect(cadenceGroup({ type: 'weekdays', days: [1, 3, 5] })).toBe('weekly');
    expect(cadenceGroup({ type: 'calendarMonth' })).toBe('monthly');
  });

  it('keeps the rest as they are', () => {
    expect(cadenceGroup({ type: 'daily', timesPerDay: 2 })).toBe('daily');
    expect(cadenceGroup({ type: 'none' })).toBe('none');
    expect(cadenceGroup({ type: 'limit', period: 'week', max: 1 })).toBe('limit');
  });
});
